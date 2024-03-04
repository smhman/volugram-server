import express from 'express';
import archiver from 'archiver';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import database from '../data/database.js';
import { rejectedSubmissionMail, acceptedSubmissionMail, sendMail } from '../helpers/mail.js';
import { getCertificatePDF } from '../helpers/pdf.js';
import createRateLimiter from '../config/ratelimitConfig.js';
import validateCaptcha from '../config/hCaptchaConfig.js';

const router = express.Router();
const limiter = createRateLimiter(60 * 1000, 5);
const certificateLimiter = createRateLimiter(60 * 1000, 3);

// INFO: Gets single submission by id
// GET /submission/:id
router.get('/submission/:id', async (req, res) => {
  try {
    const submissionId = req.params.id;
    const email = req.session.user;

    if (!email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const connection = await database.getConnection();

    const getUserIdQuery = 'SELECT id FROM users WHERE email = ?';
    const [userIdRows] = await connection.execute(getUserIdQuery, [email]);

    if (userIdRows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userId = userIdRows[0].id;

    const query = `
      SELECT s.email, s.full_name, s.submission_json, s.confirmed, s.comment, s.confirmed_by
      FROM submissions s
      WHERE s.id = ? AND s.user_id = ?
    `;

    const [rows] = await connection.execute(query, [submissionId, userId]);

    if (rows.length === 0) {
      res.status(404).json({ error: 'Submission not found or unauthorized access' });
      return;
    }

    const submission = rows[0];
    const formattedSubmission = {
      email: submission.email,
      full_name: submission.full_name,
      submission_json: JSON.parse(submission.submission_json),
    };

    await connection.release();
    res.status(200).json(formattedSubmission);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

// INFO: Gets all submissions for the logged-in user (team leader)
// GET /submission
router.get('/submission', async (req, res) => {
  try {
    const email = req.session.user;

    if (!email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const connection = await database.getConnection();

    const query = `
      SELECT submissions.id, submissions.email AS submission_email
      FROM users
      JOIN submissions ON users.id = submissions.user_id
      WHERE submissions.confirmed = 'no' AND users.email = ?
    `;

    const [rows] = await connection.execute(query, [email]);

    if (rows.length === 0) {
      res.status(404).json({ error: 'No submissions found for the given email' });
      return;
    }

    const submissions = rows.map(row => {
      const submission = {
        id: row.id,
        submission_email: row.submission_email,
      };
      return submission;
    });

    await connection.release();
    res.status(200).json(submissions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// INFO: Deletes single submission by id (if user has access to it)
// DELETE /submission/:id
router.delete('/submission/:id', async (req, res) => {
  try {
    const email = req.session.user;

    if (!email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const connection = await database.getConnection();
    const submissionId = req.params.id;

    if (!submissionId) {
      res.status(400).json({ error: 'Missing required field' });
      return;
    }

    const id = parseInt(submissionId, 10);

    const accessQuery = `
      SELECT submissions.submission_json
      FROM submissions
      JOIN users ON submissions.user_id = users.id
      WHERE submissions.id = ? AND users.email = ?
    `;

    const [accessRows] = await connection.execute(accessQuery, [id, email]);

    if (accessRows.length === 0) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const deleteQuery = 'DELETE FROM submissions WHERE id = ?';
    const [result] = await connection.execute(deleteQuery, [id]);

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }

    await connection.release();
    res.status(200).json({ message: 'Submission deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete submission' });
  }
});

// INFO: Allows outside users to submit a form (without logging in)
// POST /submission
// BODY: { email, submission_json, form_token, full_name }
router.post('/submission', limiter, async (req, res) => {
  try {
    const { email, submission_json, token: form_token, full_name, captcha_token } = req.body;

    const isValid = await validateCaptcha(captcha_token);

    if (!isValid) {
      res.status(400).json({ error: 'Invalid captcha' });
      return;
    }

    if (!email || !submission_json || !form_token || !full_name) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const connection = await database.getConnection();

    const fetchUserIdQuery = 'SELECT user_id FROM form_data WHERE token = ?';
    const [userRows] = await connection.execute(fetchUserIdQuery, [form_token]);

    if (!userRows || !userRows.length) {
      res.status(404).json({ error: 'Form does not exist' });
      return;
    }

    const user_id = userRows[0].user_id;

    const insertQuery = 'INSERT INTO submissions (user_id, email, full_name, submission_json, confirmed) VALUES (?, ?, ?, ?, ?)';
    const confirmedDefaultValue = 'no';

    const [result] = await connection.execute(insertQuery, [
      user_id,
      email,
      full_name,
      submission_json,
      confirmedDefaultValue,
    ]);

    if (result.affectedRows > 0) {
      res.status(200).json({ message: 'Submission sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send submission' });
    }

    await connection.release();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send submission' });
  }
});

// INFO: Allows logged in users to reject a submission (if they have access to it)
// POST /submission/reject
// BODY: { id, comment, who, language } (who = name of the person who rejected the submission)
router.post('/submission/reject', async (req, res) => {
  try {
    const { id, comment, who, language } = req.body;
    const email = req.session.user;

    if (!email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!id || !comment || !who || !language) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const connection = await database.getConnection();

    const accessQuery = `
      SELECT s.id AS submission_id, s.user_id, s.email AS submission_email, u.email AS user_email
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND u.email = ?
    `;

    const [accessRows] = await connection.execute(accessQuery, [id, email]);

    if (accessRows.length === 0) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const deleteQuery = 'DELETE FROM submissions WHERE id = ?';
    const [deleteResult] = await connection.execute(deleteQuery, [id]);

    if (deleteResult.affectedRows === 0) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }

    const submissionEmail = accessRows[0].submission_email;
    rejectedSubmissionMail({ email: submissionEmail, language, who, comment });

    await connection.release();
    res.status(200).json({ message: 'Submission rejected and deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject submission' });
  }
});

// INFO: Allows logged in users to confirm a submission (if they have access to it)
// POST /submission/confirm
// BODY: { id, who, language, teamLeaderReview } (who = name of the person who confirmed the submission)
router.post('/submission/confirm', async (req, res) => {
  try {
    const { id, who, language, comment, teamLeaderReview } = req.body;
    const email = req.session.user;

    if (!email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!id || !who || !language, !teamLeaderReview) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const connection = await database.getConnection();

    const accessQuery = `
      SELECT s.id AS submission_id, s.user_id, s.email AS submission_email, s.full_name as submission_full_name, s.submission_json as submission_json, s.confirmed as confirmed, u.email AS user_email
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND u.email = ?
    `;

    const [accessRows] = await connection.execute(accessQuery, [id, email]);

    if (accessRows.length === 0) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const submission = accessRows[0];
    const { submission_json, submission_email, submission_full_name, confirmed } = submission;

    if (confirmed === 'yes') {
      res.status(400).json({ error: 'Submission already confirmed' });
      return;
    }

    const pdf = await getCertificatePDF(submission_full_name, submission_json, language, teamLeaderReview);

    const updateQuery = 'UPDATE submissions SET confirmed = ?, confirmed_by = ?, certificate_pdf = ? WHERE id = ?';
    const confirmedValue = 'yes';
    const [updateResult] = await connection.execute(updateQuery, [confirmedValue, who, pdf, id]);

    if (updateResult.affectedRows === 0) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }

    acceptedSubmissionMail({ email: submission_email, language, who, comment, attachments: [{ filename: 'certificate.pdf', content: pdf }] });

    await connection.release();
    res.status(200).json({ message: 'Submission confirmed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to confirm submission' });
  }
});

// INFO: Get all certificates for a user's email
// POST /submission/certificates
// BODY: { email }
router.post('/submission/certificates', certificateLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const connection = await database.getConnection();

    const query = `
      SELECT id, certificate_pdf
      FROM submissions
      WHERE email = ? AND confirmed = 'yes'
    `;
    const [certificates] = await connection.execute(query, [email]);

    if (certificates.length === 0) {
      res.status(404).json({ message: 'No certificates found for the user.' });
      return;
    }

    const zip = archiver('zip', { zlib: { level: 9 } });
    const pdfBuffers = [];

    for (const certificate of certificates) {
      const { id, certificate_pdf } = certificate;

      const pdfBuffer = Buffer.from(certificate_pdf, 'binary');
      pdfBuffers.push({ buffer: pdfBuffer, name: `certificate_${id}.pdf` });
      zip.append(pdfBuffer, { name: `certificate_${id}.pdf` });
    }
    zip.finalize();

    const zipBuffer = await new Promise((resolve, reject) => {
      const chunks = [];
      zip.on('data', (chunk) => chunks.push(chunk));
      zip.on('end', () => resolve(Buffer.concat(chunks)));
      zip.on('error', reject);
    });

    const zipStream = Readable.from(zipBuffer);

    const subjectId = uuidv4().split('-')[0];

    const mailOptions = {
      from: 'info@volugram.eu',
      to: email,
      subject: `Certificates - ${subjectId} - Volugram`,
      text: 'Your certificates are attached.',
      attachments: [
        {
          filename: 'certificates.zip',
          content: zipStream,
        },
      ],
    };

    sendMail(mailOptions);

    res.status(200).json({ message: 'Certificates sent via email.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch and send certificates.' });
  }
});

export default router;
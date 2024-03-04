import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import database from '../data/database.js';

const router = express.Router();

// INFO: Gets single form by token (defenition to be used in the frontend for outside users)
// GET /form/:token
router.get('/form/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const connection = await database.getConnection();

    const query = 'SELECT form_definition, certificate_logo, language FROM form_data WHERE token = ?';
    const [rows] = await connection.execute(query, [token]);

    if (rows.length === 0) {
      res.status(404).json({ error: 'Form not found' });
      return;
    }

    const { form_definition, certificate_logo, language } = rows[0];
    const formDefinition = JSON.parse(form_definition);

    await connection.release();

    res.status(200).json({ formDefinition, certificateLogo: certificate_logo, language });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch form' });
  }
});

// INFO: Gets all forms for the logged in user (if they have access to any)
// GET /form
router.get('/form', async (req, res) => {
  try {
    const email = req.session.user;

    if (!email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const connection = await database.getConnection();

    const query = `SELECT form_definition, token FROM form_data WHERE user_id = (SELECT id FROM users WHERE email = ?)`;
    const [rows] = await connection.execute(query, [email]);

    if (rows.length === 0) {
      res.status(404).json({ error: 'No forms found' });
      return;
    }

    const forms = rows.map(row => ({ ...JSON.parse(row.form_definition), token: row.token }));

    await connection.release();
    res.status(200).json(forms);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

// INFO: Creates new form for the logged in user
// POST /form
// BODY: { formData: { ... }, certificateLogo: 'base64', language: 'en' }
router.post('/form', async (req, res) => {
  try {
    const email = req.session.user;

    if (!email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const connection = await database.getConnection();

    const { formData, certificateLogo, language } = req.body;

    if (!formData) {
      res.status(400).json({ error: 'Invalid form data' });
      return;
    }

    const validLanguages = ['en', 'de', 'no', 'et'];
    const validatedLanguage = validLanguages.includes(language) ? language : 'en';

    const userIdQuery = 'SELECT id FROM users WHERE email = ?';
    const [userIdRows] = await connection.execute(userIdQuery, [email]);

    if (userIdRows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userId = userIdRows[0].id;
    const formDefinition = JSON.stringify(formData);
    const token = uuidv4(); 

    const insertQuery = `
      INSERT INTO form_data (user_id, form_definition, token, certificate_logo, language)
      VALUES (?, ?, ?, ?, ?)
    `;

    let certificateLogoValue = certificateLogo || null;

    const [insertResult] = await connection.execute(insertQuery, [userId, formDefinition, token, certificateLogoValue, validatedLanguage]);

    if (insertResult.affectedRows === 1) {
      res.status(200).json({ token });
    } else {
      res.status(500).json({ error: 'Failed to insert form data' });
    }

    await connection.release();
  } catch (error) {
    res.status(500).json({ error: error.message }); // TODO: Remove error message from production
  }
});

// INFO: Deletes form by token (if user has access to it)
// DELETE /forms/:token
router.delete('/form/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const email = req.session.user;

    if (!email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const connection = await database.getConnection();

    const accessQuery = `
      DELETE form_data 
      FROM form_data
      JOIN users ON form_data.user_id = users.id
      WHERE form_data.token = ? AND users.email = ?
    `;
    
    const [result] = await connection.execute(accessQuery, [token, email]);

    if (result.affectedRows === 0) {
      res.status(403).json({ error: 'Unauthorized to delete the form' });
      return;
    }

    await connection.release();
    res.status(200).json({ message: 'Form deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete form' });
  }
});

export default router;
import express from 'express';
import bcrypt from 'bcrypt';
import database from '../data/database.js';
import { v4 as uuidv4 } from 'uuid';
import { sendMail } from '../helpers/mail.js';
import createRateLimiter from '../config/ratelimitConfig.js';

const router = express.Router();
const limiter = createRateLimiter(60 * 1000, 3);

// INFO: Stores confirmation tokens and their corresponding user information
const confirmationQueue = new Map();
const passwordResetQueue = new Map();

// INFO: Registers a new user (sends a confirmation email)
// POST /register
// Body: { name, email, password }
router.post('/register', limiter, async (req, res) => {
  const { name, email, password } = req.body;

  try {
    
    if (!name || !email || !password) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    const connection = await database.getConnection();
    
    const emailCheckQuery = 'SELECT * FROM users WHERE email = ?';
    const [existingUsers] = await connection.execute(emailCheckQuery, [email]);

    if (existingUsers.length > 0) {
      res.status(400).json({ message: 'Email already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const confirmationToken = uuidv4();

    confirmationQueue.set(confirmationToken, { name, email, hashedPassword });

    const confirmationLink = `https://api.volugram.eu/activate/${confirmationToken}`;

    sendMail({
      from: 'info@volugram.eu',
      to: email,
      subject: 'Volugram account confirmation',
      text: `Please click the following link to confirm your account: ${confirmationLink}`,
    });

    res.status(201).json({ message: 'Confirmation link has been sent' });

    await connection.release();
  } catch (error) {
    res.status(500).json({ error: 'Failed to register' });
  }
});

// INFO: Activates a user account based on the confirmation token
router.get('/activate/:confirmationToken', async (req, res) => {
  const { confirmationToken } = req.params;

  try {
    const user = confirmationQueue.get(confirmationToken);

    if (!user) {
      res.status(400).send('Invalid confirmation link or link expired');
      return;
    }

    const connection = await database.getConnection();
    const { name, email, hashedPassword } = user;

    const emailCheckQuery = 'SELECT * FROM users WHERE email = ?';
    const [existingUsers] = await connection.execute(emailCheckQuery, [email]);

    if (existingUsers.length > 0) {
      res.status(400).send('Account under the same email already exists');
      return;
    }

    const query = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
    const [result] = await connection.execute(query, [name, email, hashedPassword]);

    if (result.affectedRows > 0) {
      const htmlResponse = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              background-color: #141219;
              color: #939eab;
              font-family: sans-serif;
              font-weight: bold;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              height: 100vh;
              padding: 0 10px;
            }
            .message {
              text-align: center;
              font-weight: bold;
              font-size: 28px;
              margin-bottom: 20px;
            }
            .info-text {
              font-size: 16px;
            }
          </style>
          <title>Volugram Account Activation</title>
        </head>
        <body>
          <div class="message">Account activated successfully!</div>
          <div class="info-text">You can now close this tab.</div>
        </body>
        </html>   
      `;

      confirmationQueue.delete(confirmationToken);
      res.status(200).type('text/html').send(htmlResponse);
    } else {
      res.status(500).json({ message: 'Failed to activate account' });
    }

    await connection.release();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// INFO: Logs in a user
// POST /session
// Body: { email, password }
router.post('/session', async (req, res) => {
  const { email, password } = req.body;

  try {
    const connection = await database.getConnection();
    const query = 'SELECT * FROM users WHERE email = ?';
    const [rows] = await connection.execute(query, [email]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (isPasswordValid) {
      req.session.user = email;
      res.status(200).json({ message: 'Login successful' });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }

    await connection.release();
  } catch (error) {
    res.status(500).json({ error: 'Internal error' });
  }
});

// INFO: Logs out a user
// DELETE /session
router.delete('/session', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ message: 'Failed to destroy session' });
    } else {
      res.status(200).json({ message: 'Logout successful' });
    }
  });
});

// INFO: Sends a password reset email
// POST /password-reset
// Body: { email }
router.post('/password-reset', limiter, async (req, res) => {
  const { email } = req.body;

  try {
    const connection = await database.getConnection();
    const query = 'SELECT * FROM users WHERE email = ?';
    const [rows] = await connection.execute(query, [email]);

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Invalid email' });
    }

    const passwordResetToken = uuidv4();

    passwordResetQueue.set(passwordResetToken, email);

    const passwordResetLink = `https://api.volugram.eu/password-reset/${passwordResetToken}`;

    sendMail({
      from: 'info@volugram.eu',
      to: email,
      subject: 'Volugram password reset',
      text: `Please click the following link to reset your password: ${passwordResetLink} \n\nIf you did not request a password reset, please ignore this email.`,
    });

    res.status(200).json({ message: 'Password reset link has been sent' });

    await connection.release();
  } catch (error) {
    res.status(500).json({ error: 'Internal error' });
  }
});

// INFO: Shows the password reset form
// GET /password-reset/:passwordResetToken
router.get('/password-reset/:passwordResetToken', async (req, res) => {
  const { passwordResetToken } = req.params;

  const email = passwordResetQueue.get(passwordResetToken);

  if (!email) {
    res.status(400).send('Invalid password reset link or link expired');
    return;
  }

  const htmlResponse = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            background-color: #141219;
            color: #939eab;
            font-family: sans-serif;
            font-weight: bold;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            padding: 0 33px;
          }
          .message {
            text-align: center;
            font-weight: bold;
            font-size: 28px;
            margin-bottom: 20px;
          }
          .info-text {
            font-size: 16px;
          }
          input[type="password"] {
            margin-bottom: 10px;
            padding: 10px;
            width: 100%;
          }
          input[type="submit"] {
            padding: 10px;
            background-color: #45a049;
            color: white;
            border: none;
            cursor: pointer;
          }
        </style>
        <title>Volugram Password Reset</title>
      </head>
      <body>
        <div class="message">Reset Your Password</div>
        <form id="resetForm" method="POST">
          <label for="password">New Password:</label>
          <input type="password" id="password" name="password" required>
          <input type="submit" value="Reset Password">
        </form>
        <div id="resetMessage"></div>
        <script>
          const resetForm = document.getElementById('resetForm');
          resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            const passwordResetToken = '${passwordResetToken}';
            
            try {
              const response = await fetch('/password-reset/' + passwordResetToken, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
              });
              const data = await response.json();
              if (response.ok) {
                document.getElementById('resetMessage').innerText = 'Password reset successful! You can now close this tab.';
              } else {
                document.getElementById('resetMessage').innerText = 'The link is invalid or expired.';
              }
            } catch (error) {
              console.error('Error:', error);
            }
          });
        </script>
      </body>
    </html>
  `;

  res.send(htmlResponse);
});

// INFO: Resets the password
// POST /password-reset/:passwordResetToken
router.post('/password-reset/:passwordResetToken', async (req, res) => {
  const { password } = req.body;
  const { passwordResetToken } = req.params;

  try {
    const connection = await database.getConnection();

    const userEmail = passwordResetQueue.get(passwordResetToken);
    if (!userEmail) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const updateQuery = 'UPDATE users SET password = ? WHERE email = ?';
    const [result] = await connection.execute(updateQuery, [hashedPassword, userEmail]);

    if (result.affectedRows > 0) {
      passwordResetQueue.delete(passwordResetToken);

      // check for other tokens with the same email and delete them
      for (const [token, email] of passwordResetQueue) {
        if (email === userEmail && token !== passwordResetToken) {
          passwordResetQueue.delete(token);
        }
      }

      res.status(200).json({ message: 'Password reset successful' });
    } else {
      res.status(500).json({ message: 'Failed to reset password' });
    }

    await connection.release();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// INFO: Returns the current user session information (can also be used to check if user is logged in)
// GET /session
router.get('/session', async (req, res) => {
  const email = req.session.user;

  if (!email) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const connection = await database.getConnection();
    const query = 'SELECT email, image, name FROM users WHERE email = ?';
    const [rows] = await connection.execute(query, [email]);

    if (rows.length > 0) {
      const userData = rows.map((row) => {
        const imageBuffer = row.image;
        const imageText = imageBuffer ? imageBuffer.toString('utf8') : null;

        // removes the leading and trailing single quotes from the image text
        let sanitizedImageText = imageText ? imageText.replace(/^'/, '') : null;
        sanitizedImageText = sanitizedImageText ? sanitizedImageText.replace(/'$/, '') : null;

        return {
          name: row.name,
          email: row.email,
          image: sanitizedImageText,
        };
      });

      res.status(200).json({ status: 'success', data: userData });
    } else {
      res.status(500).json({ message: 'Failed to fetch users' });
    }

    connection.release();
  } catch (error) {
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
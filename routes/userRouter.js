import express from 'express';
import multer from 'multer';
import mime from 'mime-types';
import { Readable } from 'stream';
import database from '../data/database.js';
import createRateLimiter from '../config/ratelimitConfig.js';

const router = express.Router();
const limiter = createRateLimiter(60 * 1000, 5);

// INFO: Set up multer storage configuration
const storage = multer.memoryStorage();
const upload = multer({ storage });

// INFO: Sets the user avatar image
// PUT /profile/avatar
// Body: { image: base64 + URI encoded image  }
router.put('/profile/avatar', limiter, upload.single('image'), async (req, res) => {
  const imageBuffer = req.file.buffer;
  const email = req.session.user;

  if (!email) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!imageBuffer) {
    console.log(imageBuffer);
    return res.status(400).json({ message: 'Missing image field in the request' });
  }

  try {
    const tempBuffer = [];
    const imageStream = new Readable();
    imageStream.push(imageBuffer);
    imageStream.push(null);

    imageStream.on('data', chunk => {
      tempBuffer.push(chunk);
    });

    imageStream.on('end', async () => {
      try {
        const concatenatedBuffer = Buffer.concat(tempBuffer);
        const fileExtension = mime.extension(req.file.mimetype);
        const base64Image = `data:image/${fileExtension};base64,${Buffer.from(concatenatedBuffer).toString('base64')}`;

        const connection = await database.getConnection();
        const query = 'UPDATE users SET image = ? WHERE email = ?';
        const [result] = await connection.execute(query, [base64Image, email]);

        if (result.affectedRows > 0) {
          res.status(200).json({ message: 'Avatar image updated successfully' });
        } else {
          res.status(500).json({ message: 'Failed to update avatar image' });
        }

        connection.release();
      } catch (error) {
        console.error('Failed to update avatar:', error);
        res.status(500).json({ error: 'Failed to update avatar' });
      }
    });
  } catch (error) {
    console.error('Error processing avatar:', error);
    res.status(500).json({ error: 'Error processing avatar' });
  }
});

// INFO: Sets the user name
// PUT /profile/name
// Body: { name }
router.put('/profile/name', limiter, async (req, res) => {
  const { name } = req.body;
  const email = req.session.user;

  if (!email) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!name) {
    return res.status(400).json({ message: 'Missing name field in the request' });
  }

  try {
    const connection = await database.getConnection();
    const query = 'UPDATE users SET name = ? WHERE email = ?';
    const [result] = await connection.execute(query, [name, email]);

    if (result.affectedRows > 0) {
      res.status(200).json({ message: 'Name updated successfully' });
    } else {
      res.status(500).json({ message: 'Failed to update name' });
    }

    connection.release();
  } catch (error) {
    res.status(500).json({ error: 'Failed to update name' });
  }
});

export default router;
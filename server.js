require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const logger = require('./utils/logger');
const { sequelize } = require('./models'); 
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Basic route
app.get('/', (req, res) => {
  res.send('HealthPal API is running');
});

// Import routes
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

// Error handler
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

// Start server after DB connect
async function start() {
  try {
    await sequelize.authenticate();
    logger.info('Database connected');

    // 🧱 تفعيل sync (خلال التطوير فقط)
    // await sequelize.sync({ alter: true }); // لتحديث البنية عند الحاجة
    await sequelize.sync(); // safer — only creates tables if they don't exist

    app.listen(PORT, () => {
      logger.info(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start app', err);
    process.exit(1);
  }
}

start();

module.exports = app;

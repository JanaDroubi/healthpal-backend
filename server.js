const express = require('express');
const { sequelize } = require('./config/db');
const SponsorshipCase = require('./models/SponsorshipCase');

sequelize.sync({ alter: true }).then(() => console.log('Database synced'));

const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('API running 🚀'));

app.listen(3000, () => console.log('Server running on http://localhost:3000'));

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
    require('./models'); // <-- أضف هذا السطر
    await sequelize.authenticate();
    logger.info('Database connected');
    await sequelize.sync(); 

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

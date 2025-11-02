const express = require('express');
const colors = require('colors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const mySqlPool = require("./config/db");

dotenv.config();

const app = express();
app.use(express.json());
app.use(morgan("dev"));

// routes
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/patients", require("./routes/patientRoutes"));
app.use("/api/doctors", require("./routes/doctorRoutes"));
app.use("/api/consultations", require("./routes/consultationRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));
app.use("/api/supportGroups", require("./routes/supportGroupsRoutes"));
app.use("/api/therapy", require("./routes/therapyRoutes"));

app.get('/test', (req, res) => res.send('hello world'));

const http = require('http');
const server = http.createServer(app);

const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

const { attachConsultationChat } = require('./socket/socket');
const { attachTherapyChat } = require('./socket/therapySocket');
attachConsultationChat(io);
attachTherapyChat(io);

const PORT = process.env.PORT || 3100;

mySqlPool.query('SELECT 1').then(() => {
  console.log('MYSQL DB Connected'.bgCyan.white);
  server.listen(PORT, () =>
    console.log(`Server + WebSocket Running on port ${PORT}`.bgMagenta.white)
  );
}).catch(console.error);

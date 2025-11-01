const express = require('express');
const colors = require('colors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const mySqlPool = require("./config/db");

//configure dotenv
dotenv.config();

// Express App
const app = express();

//middlewares
app.use(express.json());
app.use(morgan("dev"));

//routes
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/patients", require("./routes/patientRoutes"));
app.use("/api/doctors", require("./routes/doctorRoutes"));
app.use("/api/consultations", require("./routes/consultationRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));

app.use("/api/donors", require("./routes/donorRoutes"));
app.use("/api/sponsorship", require("./routes/sponsorshipRoutes"));
app.use("/api/donations", require("./routes/donationRoutes"));
app.use("/api/invoices", require("./routes/invoiceRoutes"));
app.use("/api/receipts", require("./routes/receiptRoutes"));
app.use("/api/updates", require("./routes/recoveryUpdates"));
app.use("/api/feedbacks", require("./routes/patientFeedback"));

app.use("/api/medication", require("./routes/medicationRoutes"));
app.use("/api/equipment", require("./routes/equipmentRoutes"));


app.use("/api/ai", require("./routes/aiRoutes"));
app.use("/api/ai-review", require("./routes/aiReviewRoutes"));


app.get('/test', (req, res) => {
    res.send('hello world');
});

// ==== أضفنا السيرفر + السوكِت هنا فقط ====
const http = require('http');
const server = http.createServer(app);

const { createSocketServer } = require('./socket/socket');
createSocketServer(server);
// =========================================

//port
const PORT = process.env.PORT || 3100;

//contidionaly Listen
mySqlPool.query('SELECT 1')
.then(() => {
    console.log('MYSQL DB Connected'.bgCyan.white);

    // لازم نستخدم server.listen بدل app.listen
    server.listen(PORT, () => {
        console.log(`Server + WebSocket Running on port ${PORT}`.bgMagenta.white);
    });
})
.catch((error) => {
    console.log(error);
});

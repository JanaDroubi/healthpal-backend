const express = require("express");
const colors = require("colors");
const morgan = require("morgan");
const dotenv = require("dotenv");
const mySqlPool = require("./config/db");

dotenv.config();

const app = express();
app.use(express.json());
app.use(morgan("dev"));

// Routes
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/patients", require("./routes/patientRoutes"));
app.use("/api/doctors", require("./routes/doctorRoutes"));
app.use("/api/consultations", require("./routes/consultationRoutes"));
app.use("/api/supportGroups", require("./routes/supportGroupsRoutes"));
app.use("/api/therapy", require("./routes/therapyRoutes"));
app.use("/api/donors", require("./routes/donorRoutes"));
app.use("/api/sponsorship", require("./routes/sponsorshipRoutes"));
app.use("/api/donations", require("./routes/donationRoutes"));
app.use("/api/invoices", require("./routes/invoiceRoutes"));
app.use("/api/receipts", require("./routes/receiptRoutes"));
app.use("/api/updates", require("./routes/recoveryUpdates"));
app.use("/api/feedbacks", require("./routes/patientFeedback"));
app.use("/api/equipment", require("./routes/equipmentRoutes"));
app.use("/api/medication", require("./routes/medicationRoutes"));
app.use(
  "/api/medication-requests",
  require("./routes/medicationDeliveryRouter")
);
app.use("/api/inventory", require("./routes/inventoryRouters"));
app.use("/api/ai", require("./routes/aiRoutes"));
app.use("/api/ai-review", require("./routes/aiReviewRoutes"));
app.use("/api/VerifyDoctor", require("./routes/doctorVerificationRoutes"));
app.use("/api/ngos", require("./routes/ngoRouters"));
app.use("/api/mission", require("./routes/missionRoutes.js"));

app.get("/test", (req, res) => res.send("hello world"));

const http = require("http");
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const { attachConsultationChat } = require("./socket/socket");
const { attachTherapyChat } = require("./socket/therapySocket");
if (typeof attachConsultationChat === "function") attachConsultationChat(io);
if (typeof attachTherapyChat === "function") attachTherapyChat(io);

const PORT = process.env.PORT || 3100;

mySqlPool
  .query("SELECT 1")
  .then(() => {
    console.log("MYSQL DB Connected".bgCyan.white);
    server.listen(PORT, () => {
      console.log(`Server + WebSocket Running on port ${PORT}`.bgMagenta.white);
    });
  })
  .catch((error) => {
    console.error("MySQL Connection Error:", error);
  });

const dotenv = require("dotenv");
const express = require("express");
const colors = require("colors");
const morgan = require("morgan");
const mySqlPool = require("./config/db");

//configure dotenv
dotenv.config();

//rest object
const app = express();

//middlewares
app.use(express.json());
app.use(morgan("dev"));

//routes
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/patients", require("./routes/patientRoutes"));
app.use("/api/doctors", require("./routes/doctorRoutes"));
app.use("/api/consultations", require("./routes/consultationRoutes"));

app.use("/api/donors", require("./routes/donorRoutes"));
app.use("/api/sponsorship", require("./routes/sponsorshipRoutes"));
app.use("/api/donations", require("./routes/donationRoutes"));
app.use("/api/invoices", require("./routes/invoiceRoutes"));
app.use("/api/receipts", require("./routes/receiptRoutes"));
app.use("/api/updates", require("./routes/recoveryUpdates"));
app.use("/api/feedbacks", require("./routes/patientFeedback"));

app.use("/api/medication", require("./routes/medicationRoutes"));
app.use("/api/equipment", require("./routes/equipmentRoutes"));

app.get("/test", (req, res) => {
  res.send("hello world");
});

//port
const PORT = process.env.PORT || 3100;

//contidionaly Listen
mySqlPool
  .query("SELECT DATABASE() AS db")
  .then(([rows]) => {
    if (rows[0].db) {
      console.log(`MYSQL Connected to database: ${rows[0].db}`.bgCyan.white);
      app.listen(PORT, () => {
        console.log(`Server Running on port ${PORT}`.bgMagenta.white);
      });
    } else {
      console.log("MYSQL connected but no database selected!".bgRed.white);
    }
  })
  .catch((error) => {
    console.log("MYSQL Connection Failed: ", error);
  });

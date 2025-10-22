const express = require('express');
const colors = require('colors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const mySqlPool = require("./config/db")


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
app.use("/api/donors", require("./routes/donorRoutes"));
app.use("/api/sponsorship", require("./routes//sponsorshipRoutes"));


app.get('/test', (req, res) => {
    res.send('hello world');
});

//port
const PORT = process.env.PORT || 3100;

//contidionaly Listen
mySqlPool.query('SELECT 1').then(() => {

    //MY SQL
    console.log('MYSQL DB Connected'.bgCyan.white)
    //listen
    app.listen(PORT, () => {
        console.log(`Server Running on port ${PORT}`.bgMagenta.white);
    });
}).catch((error)=>{
    console.log(error);
});

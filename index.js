const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'https://mediqueue-app.web.app'], // Change to your live link
    credentials: true
}));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// JWT Verification Middleware
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        req.decoded = decoded;
        next();
    });
};

async function run() {
    try {
        const database = client.db("mediQueueDB");
        const tutorCollection = database.collection("tutors");
        const bookingCollection = database.collection("bookings");

        // Auth API: Generate JWT Token
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' });
            res.send({ token });
        });

        // --- TUTORS APIs ---

        // Get Tutors with Search, Filter & Limit
        app.get('/tutors', async (req, res) => {
            const { search, startDate, endDate, limit } = req.query;
            let query = {};

            // Case-insensitive Search by Tutor Name
            if (search) {
                query.tutorName = { $regex: search, $options: 'i' };
            }

            // Date Filtering ($gte, $lte)
            if (startDate && endDate) {
                query.sessionStartDate = {
                    $gte: startDate,
                    $lte: endDate
                };
            }

            let cursor = tutorCollection.find(query);
            
            if (limit) {
                cursor = cursor.limit(parseInt(limit));
            }

            const result = await cursor.toArray();
            res.send(result);
        });

        // Get single tutor details
        app.get('/tutors/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await tutorCollection.findOne(query);
            res.send(result);
        });

        // Add a Tutor (Private Route)
        app.post('/tutors', verifyToken, async (req, res) => {
            const newTutor = req.body;
            const result = await tutorCollection.insertOne(newTutor);
            res.send(result);
        });

        // Get tutors added by a specific user (Table View)
        app.get('/my-tutors', verifyToken, async (req, res) => {
            const email = req.query.email;
            if (req.decoded.email !== email) {
                return res.status(403).send({ message: 'Forbidden access' });
            }
            const query = { userEmail: email };
            const result = await tutorCollection.find(query).toArray();
            res.send(result);
        });

        // Update Tutor
        app.put('/tutors/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedTutor = req.body;
            const updateDoc = {
                $set: {
                    tutorName: updatedTutor.tutorName,
                    photo: updatedTutor.photo,
                    subject: updatedTutor.subject,
                    availableDays: updatedTutor.availableDays,
                    hourlyFee: updatedTutor.hourlyFee,
                    totalSlot: parseInt(updatedTutor.totalSlot),
                    sessionStartDate: updatedTutor.sessionStartDate,
                    institution: updatedTutor.institution,
                    location: updatedTutor.location,
                    teachingMode: updatedTutor.teachingMode
                },
            };
            const result = await tutorCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // Delete Tutor
        app.delete('/tutors/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await tutorCollection.deleteOne(query);
            res.send(result);
        });


        // --- BOOKINGS APIs ---

        // Book a session (With Atomicity / Conditional Update)
        app.post('/bookings', verifyToken, async (req, res) => {
            const booking = req.body;
            const tutorId = booking.tutorId;

            // Step 1: Check constraints on tutor side
            const tutor = await tutorCollection.findOne({ _id: new ObjectId(tutorId) });
            if (!tutor) {
                return res.status(404).send({ message: "Tutor not found" });
            }

            if (tutor.totalSlot <= 0) {
                return res.status(400).send({ message: "This session is fully booked. You can't join at the moment." });
            }

            const today = new Date().toISOString().split('T')[0];
            if (today < tutor.sessionStartDate) {
                return res.status(400).send({ message: "Booking is not available yet for this tutor" });
            }

            // Step 2: Insert Booking
            const bookingResult = await bookingCollection.insertOne(booking);

            // Step 3: Auto decrease slot by 1
            await tutorCollection.updateOne(
                { _id: new ObjectId(tutorId) },
                { $inc: { totalSlot: -1 } }
            );

            res.send(bookingResult);
        });

        // Get current student's booked sessions
        app.get('/my-bookings', verifyToken, async (req, res) => {
            const email = req.query.email;
            if (req.decoded.email !== email) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
            const query = { studentEmail: email };
            const result = await bookingCollection.find(query).toArray();
            res.send(result);
        });

        // Cancel a booking (PATCH request to update status)
        app.patch('/bookings/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: { status: 'cancelled' },
            };
            const result = await bookingCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        console.log("Connected successfully to MongoDB!");
    } finally {
        // Keep active
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('MediQueue Server is running...');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
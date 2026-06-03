const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const axios = require('axios'); // 
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const dns = require('dns');
const bcrypt = require('bcrypt');

dotenv.config();

// Cloudflare DNS dns.setServers(['1.1.1.1', '8.8.8.8']);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
    origin: true,
    credentials: true,
}));

app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vixw6gg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
    }
});

let tutorCollection;
let bookingCollection;
let userCollection;

// JWT VERIFY MIDDLEWARE
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({
            message: 'Unauthorized access'
        });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(
        token,
        process.env.JWT_SECRET,
        (err, decoded) => {
            if (err) {
                return res.status(403).send({
                    message: 'Forbidden: Invalid Token'
                });
            }
            req.user = decoded;
            next();
        }
    );
};

async function startServer() {
    try {
        await client.connect();
        console.log('✅ MongoDB Connected');

        const db = client.db('mediQueueDB');

        tutorCollection = db.collection('tutors');
        bookingCollection = db.collection('bookings');
        userCollection = db.collection('users');

        app.listen(port, () => {
            console.log(`🚀 Server running on port ${port}`);
        });

    } catch (error) {
        console.error('❌ MongoDB Connection Failed', error);
    }
}

startServer();
connectDB();

// 🛠️ GOOGLE LOGIN (Axios Version - Ultimate Stability for useGoogleLogin)
// 🛠️ GOOGLE LOGIN (Ultimate Stable Version using Axios)
app.post('/google-login', async (req, res) => {
    try {

         console.log("BODY:", req.body);
        const { credential } = req.body;
        console.log("TOKEN:", credential); // 

        if (!credential) {
            return res.status(400).send({ message: 'Access Token is required' });
        }

        // 
        const googleResponse = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo`, {
            headers: {
                Authorization: `Bearer ${credential}`
            }
        });
        console.log("GOOGLE DATA:", googleResponse.data);

        const payload = googleResponse.data;

        if (!payload || !payload.email) {
            return res.status(401).send({ message: 'Invalid Google Access Token' });
        }

        // 
const existingUser = await userCollection.findOne({
    email: payload.email
});

let dbUser;

if (existingUser) {

    // Google account এর latest name + photo update
    await userCollection.updateOne(
        { email: payload.email },
        {
            $set: {
                name: payload.name,
                photo: payload.picture
            }
        }
    );

    dbUser = await userCollection.findOne({
        email: payload.email
    });

} else {

    const newUser = {
        name: payload.name,
        email: payload.email,
        photo: payload.picture,
        createdAt: new Date(),
        role: 'student'
    };

    const result = await userCollection.insertOne(newUser);

    dbUser = {
        _id: result.insertedId,
        ...newUser
    };
}

        const user = {
    id: dbUser._id,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
};

        // JWT 
        const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.send({ token, user });

    } catch (error) {
        console.error('Google Login Catch Error:', error.response?.data || error.message);
        res.status(401).send({ message: 'Google Authentication Failed' });
    }
});

// CURRENT USER
app.get('/current-user', verifyToken, (req, res) => {
    res.send(req.user);
});

// REGISTER
app.post('/register', async (req, res) => {
    try {
        const { name, email, password, photo } = req.body;
        const existingUser = await userCollection.findOne({ email });

        if (existingUser) {
            return res.status(400).send({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = {
            name,
            email,
            password: hashedPassword,
            photo,
            createdAt: new Date()
        };

        await userCollection.insertOne(user);
        res.send({ success: true, message: 'Registration Successful' });
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: 'Registration failed' });
    }
});

// LOGIN WITH EMAIL/PASSWORD
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await userCollection.findOne({ email });

        if (!user) {
            return res.status(401).send({ message: 'Invalid credentials' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).send({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { email: user.email, name: user.name, picture: user.photo },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.send({ token, user });
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: 'Login failed' });
    }
});

// TUTORS PUBLIC GET (All & Specific)
app.get('/tutors', async (req, res) => {
    try {
        const { search, startDate, endDate, limit } = req.query;
        let query = {};

        if (search) {
            query.tutorName = { $regex: search, $options: 'i' };
        }

        if (startDate || endDate) {
            query.sessionStartDate = {};
            if (startDate) query.sessionStartDate.$gte = startDate;
            if (endDate) query.sessionStartDate.$lte = endDate;
        }

        let cursor = tutorCollection.find(query);
        if (limit) cursor = cursor.limit(parseInt(limit));

        const tutors = await cursor.toArray();
        res.send(tutors);
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: 'Failed to load tutors' });
    }
});

//  TUTOR DETAILS GET ROUTE 
app.get('/tutors/:id', async (req, res) => {
    try {
        const id = req.params.id;

        // 🌟 চেক করা হচ্ছে ID টি MongoDB ObjectId এর নিয়মে সঠিক কি না
        if (!ObjectId.isValid(id)) {
            console.log(`⚠️ Invalid ObjectId received: ${id}`);
            return res.status(400).send({ message: 'Invalid Tutor ID format' });
        }

        const tutor = await tutorCollection.findOne({ _id: new ObjectId(id) });

        if (!tutor) {
            return res.status(404).send({ message: 'Tutor not found' });
        }
        res.send(tutor);
    } catch (error) {
        console.log('Tutor Details Error', error);
        res.status(500).send({ message: 'Failed to load tutor details' });
    }
});





// SECURED TUTOR ROUTES (Token Required)
app.post('/tutors', verifyToken, async (req, res) => {
    try {
        const tutor = req.body;
        const result = await tutorCollection.insertOne(tutor);
        res.send(result);
    } catch (error) {
        console.log('Add Tutor Error', error);
        res.status(500).send({ message: 'Failed to add tutor' });
    }
});

app.put('/tutors/:id', verifyToken, async (req, res) => {
    try {
        const id = req.params.id;
        const updatedTutor = req.body;

        // ObjectId Validation
        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                message: 'Invalid Tutor ID'
            });
        }

        // Ownership Check
        const result = await tutorCollection.updateOne(
            {
                _id: new ObjectId(id),
                userEmail: req.user.email
            },
            {
                $set: updatedTutor
            }
        );

        if (result.matchedCount === 0) {
            return res.status(403).send({
                message: 'You can only update your own tutor'
            });
        }

        res.send(result);

    } catch (error) {
        console.log(error);
        res.status(500).send({
            message: 'Failed to update tutor'
        });
    }
});

app.delete('/tutors/:id', verifyToken, async (req, res) => {
    try {
        const id = req.params.id;

if (!ObjectId.isValid(id)) {
    return res.status(400).send({
        message: 'Invalid Tutor ID'
    });
}
        
        const query = { 
            _id: new ObjectId(id),
            userEmail: req.user.email 
        };

        const result = await tutorCollection.deleteOne(query);
        
        if(result.deletedCount === 0) {
            return res.status(403).send({ message: "You don't have permission to delete this listing" });
        }

        res.send(result);
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: 'Failed to delete tutor' });
    }
});

app.get('/my-tutors', verifyToken, async (req, res) => {
    try {
        const email = req.query.email;

        if (req.user.email !== email) {
            return res.status(403).send({ message: 'Forbidden access' });
        }

        const tutors = await tutorCollection
            .find({ userEmail: email })
            .toArray();

        res.send(tutors);
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: 'Failed to load tutors' });
    }
}); 

// BOOKINGS ROUTES
app.post('/bookings', verifyToken, async (req, res) => {
    try {

        console.log("BOOKING BODY:", req.body);

        const booking = req.body;

        const newBooking = {
            tutorId: booking.tutorId,
            tutorName: booking.tutorName,
            tutorPhoto: booking.tutorPhoto ?? booking.tutorPhotoUrl ?? '',
            studentName: booking.studentName,
            studentEmail: req.user.email,
            phone: booking.phone,
            specialNote: booking.specialNote || '',
            status: 'booked',
            bookingDate: new Date()
        };

        console.log("NEW BOOKING:", newBooking);

        const result = await bookingCollection.insertOne(newBooking);

        res.send(result);

    } catch (error) {
        console.log(error);
        res.status(500).send({ message: 'Failed to create booking' });
    }
});

app.get('/my-bookings', verifyToken, async (req, res) => {
    try {
        const email = req.query.email;
        if (req.user.email !== email) {
            return res.status(403).send({ message: 'Forbidden access' });
        }

        const bookings = await bookingCollection
            .find({ studentEmail: email })
            .toArray();

        res.send(bookings);
    } catch (error) {
        console.log('My Bookings Error', error);
        res.status(500).send({ message: 'Failed to load bookings' });
    }
});

app.patch('/bookings/:id', verifyToken, async (req, res) => {
    try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                message: 'Invalid Booking ID'
            });
        }

        const result = await bookingCollection.updateOne(
            {
                _id: new ObjectId(id),
                studentEmail: req.user.email
            },
            {
                $set: {
                    status: 'cancelled'
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(403).send({
                message: 'You can only cancel your own booking'
            });
        }

        res.send(result);

    } catch (error) {
        console.log('Booking Cancel Error', error);
        res.status(500).send({
            message: 'Failed to cancel booking'
        });
    }
});


app.get('/', (req, res) => {
    res.send('MediQueue Main Gateway Active');
});

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});

// DNS TEST
/*
dns.resolveSrv(
    '_mongodb._tcp.cluster0.vixw6gg.mongodb.net',
    (err, records) => {
        console.log(err || records);
    }
);
*/
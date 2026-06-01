const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { OAuth2Client } = require('google-auth-library');
const { MongoClient, ServerApiVersion, ObjectId  } = require('mongodb');
const dns = require('dns');
const bcrypt = require('bcrypt');


dotenv.config();

// Cloudflare DNS
dns.setServers(['1.1.1.1', '8.8.8.8']);

const app = express();
const port = process.env.PORT || 5000;

const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID
);

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());

const uri =
`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vixw6gg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

    const authHeader =
        req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({
            message: 'Unauthorized'
        });
    }

    const token =
        authHeader.split(' ')[1];

    jwt.verify(
        token,
        process.env.JWT_SECRET,
        (err, decoded) => {

            if (err) {
                return res.status(401).send({
                    message: 'Invalid Token'
                });
            }

            req.user = decoded;

            next();
        }
    );
};

async function connectDB() {

    try {

        await client.connect();

        console.log('✅ MongoDB Connected');

       const db =
    client.db('mediQueueDB');

tutorCollection =
    db.collection('tutors');

bookingCollection =
    db.collection('bookings');

userCollection =
    db.collection('users');

    } catch (error) {

        console.log('❌ MongoDB Error');
        console.log(error);

    }

}

connectDB();

// GOOGLE LOGIN
app.post(
    '/google-login',
    async (req, res) => {

        try {

            const { credential } =
                req.body;

            const ticket =
                await googleClient.verifyIdToken({
                    idToken: credential,
                    audience:
                        process.env.GOOGLE_CLIENT_ID,
                });

            const payload =
                ticket.getPayload();

            const user = {
                email: payload.email,
                name: payload.name,
                picture: payload.picture,
            };

            const token = jwt.sign(
                user,
                process.env.JWT_SECRET,
                {
                    expiresIn: '7d',
                }
            );

            res.send({
                token,
                user,
            });

        } catch (error) {

            console.log(error);

            res.status(401).send({
                message: 'Invalid Google Token',
            });

        }

    }
);

// CURRENT USER
app.get(
    '/current-user',
    verifyToken,
    (req, res) => {

        res.send(req.user);

    }
);

// REGISTER
app.post(
    '/register',
    async (req, res) => {

        try {

            const {
                name,
                email,
                password,
                photo
            } = req.body;

            const existingUser =
                await userCollection.findOne({
                    email
                });

            if (existingUser) {

                return res.status(400).send({
                    message: 'User already exists'
                });

            }

            const hashedPassword =
  await bcrypt.hash(password, 10);

const user = {
    name,
    email,
    password: hashedPassword,
    photo,
    createdAt: new Date()
};

await userCollection.insertOne(user);

res.send({
    success: true,
    message: 'Registration Successful'
});

            

            

        } catch (error) {

            console.log(error);

            res.status(500).send({
                message: 'Registration failed'
            });

        }

    }
);

// LOGIN WITH EMAIL/PASSWORD
app.post(
  '/login',
  async (req, res) => {

    try {

      const { email, password } = req.body;

      const user =
        await userCollection.findOne({
          email
        });

      if (!user) {
        return res.status(401).send({
          message: 'Invalid credentials'
        });
      }

      const passwordMatch =
        await bcrypt.compare(
          password,
          user.password
        );

      if (!passwordMatch) {
        return res.status(401).send({
          message: 'Invalid credentials'
        });
      }

      const token = jwt.sign(
        {
          email: user.email,
          name: user.name,
          picture: user.photo
        },
        process.env.JWT_SECRET,
        {
          expiresIn: '7d'
        }
      );

      res.send({
        token,
        user
      });

    } catch (error) {

      console.log(error);

      res.status(500).send({
        message: 'Login failed'
      });

    }

  }
);

// TUTORS


app.get('/tutors', async (req, res) => {
try {

    const {
        search,
        startDate,
        endDate,
        limit
    } = req.query;

    let query = {};

    if (search) {
        query.tutorName = {
            $regex: search,
            $options: 'i'
        };
    }

    if (startDate || endDate) {

        query.sessionStartDate = {};

        if (startDate) {
            query.sessionStartDate.$gte = startDate;
        }

        if (endDate) {
            query.sessionStartDate.$lte = endDate;
        }
    }

    let cursor =
        tutorCollection.find(query);

    if (limit) {
        cursor =
            cursor.limit(parseInt(limit));
    }

    const tutors =
        await cursor.toArray();

    res.send(tutors);

} catch (error) {

    console.log(error);

    res.status(500).send({
        message: 'Failed to load tutors'
    });

}

});

app.get(
    '/tutors/:id',
    async (req, res) => {

        try {

            const id =
                req.params.id;

            const tutor =
                await tutorCollection.findOne({
                    _id: new ObjectId(id)
                });

            if (!tutor) {

                return res.status(404).send({
                    message: 'Tutor not found'
                });

            }

            res.send(tutor);

        } catch (error) {

            console.log(
                'Tutor Details Error'
            );

            console.log(error);

            res.status(500).send({
                message:
                    'Failed to load tutor details'
            });

        }

    }
);


app.post(
    '/tutors',
    async (req, res) => {

        try {

            const tutor =
                req.body;

            const result =
                await tutorCollection.insertOne(
                    tutor
                );

            res.send(result);

        } catch (error) {

            console.log(
                'Add Tutor Error'
            );

            console.log(error);

            res.status(500).send({
                message:
                    'Failed to add tutor'
            });

        }

    }
);

app.put('/tutors/:id', async (req, res) => {
    try {

        const id = req.params.id;
        const updatedTutor = req.body;

        const result =
            await tutorCollection.updateOne(
                {
                    _id: new ObjectId(id)
                },
                {
                    $set: updatedTutor
                }
            );

        res.send(result);

    } catch (error) {

        console.log(error);

        res.status(500).send({
            message: 'Failed to update tutor'
        });

    }
});

app.delete('/tutors/:id', async (req, res) => {
    try {

        const id = req.params.id;

        const result =
            await tutorCollection.deleteOne({
                _id: new ObjectId(id)
            });

        res.send(result);

    } catch (error) {

        console.log(error);

        res.status(500).send({
            message: 'Failed to delete tutor'
        });

    }
});
app.get('/my-tutors', async (req, res) => {
    try {

        const email = req.query.email;

        const tutors = await tutorCollection
            .find({ userEmail: email })
            .toArray();

        res.send(tutors);

    } catch (error) {

        console.log(error);

        res.status(500).send({
            message: 'Failed to load tutors'
        });

    }
}); 

app.post(
  '/bookings',
  async (req, res) => {

    try {

      const booking = req.body;

      const result =
        await bookingCollection.insertOne(
          booking
        );

      res.send(result);

    } catch (error) {

      console.log(error);

      res.status(500).send({
        message: 'Failed to create booking'
      });

    }

  }
);

app.get(
    '/my-bookings',
    async (req, res) => {

        try {

            const email =
                req.query.email;

            const bookings =
                await bookingCollection
                    .find({
                        studentEmail: email
                    })
                    .toArray();

            res.send(bookings);

        } catch (error) {

            console.log(
                'My Bookings Error'
            );

            console.log(error);

            res.status(500).send({
                message:
                    'Failed to load bookings'
            });

        }

    }
);

app.patch(
    '/bookings/:id',
    async (req, res) => {

        try {

            const id =
                req.params.id;

            const result =
                await bookingCollection.updateOne(
                    {
                        _id: new ObjectId(id)
                    },
                    {
                        $set: {
                            status: 'cancelled'
                        }
                    }
                );

            res.send(result);

        } catch (error) {

            console.log(
                'Booking Cancel Error'
            );

            console.log(error);

            res.status(500).send({
                message:
                    'Failed to cancel booking'
            });

        }

    }
);

app.get('/', (req, res) => {

    res.send(
        'MediQueue Main Gateway Active'
    );

});

app.listen(
    port,
    () => {

        console.log(
            `🚀 Server running on port ${port}`
        );

    }
);

// DNS TEST
dns.resolveSrv(
    '_mongodb._tcp.cluster0.vixw6gg.mongodb.net',
    (err, records) => {

        console.log('DNS TEST');

        console.log(
            err || records
        );

    }
);
🏥 MediQueue Server (Backend API)

A secure and scalable backend API for the MediQueue platform built with Node.js, Express, MongoDB, JWT authentication, and Google OAuth login.

🚀 Live Features
🔐 JWT Authentication (Login/Register)
🔑 Google OAuth Login (Axios-based)
👨‍⚕️ Tutor Management (CRUD)
📅 Booking System (Create / View / Cancel)
👤 User Management (MongoDB-based)
🛡️ Protected Routes (Token Verification)
🔎 Search & Filter Tutors
📸 Profile Photo support (Google + manual)
🛠️ Tech Stack
Node.js
Express.js
MongoDB (Atlas)
JWT (jsonwebtoken)
bcrypt.js
Axios
dotenv
CORS
📦 Installation
git clone https://github.com/injamamulhoqtamim-bit/mediqueue-server.git
cd mediqueue-server
npm install
⚙️ Environment Variables

Create a .env file in root:

DB_USER=your_mongodb_username
DB_PASS=your_mongodb_password
JWT_SECRET=your_jwt_secret
PORT=5000
▶️ Run Project
Development:
npm start

Server will run on:

http://localhost:5000
🔐 Authentication System
Register User
POST /register
Login User
POST /login
Google Login
POST /google-login
Get Current User (Protected)
GET /current-user
👨‍⚕️ Tutor APIs
Get All Tutors
GET /tutors
Get Single Tutor
GET /tutors/:id
Add Tutor (Protected)
POST /tutors
Update Tutor (Protected)
PUT /tutors/:id
Delete Tutor (Protected)
DELETE /tutors/:id
My Tutors (Protected)
GET /my-tutors?email=user@email.com
📅 Booking APIs
Create Booking (Protected)
POST /bookings
My Bookings (Protected)
GET /my-bookings?email=user@email.com
Cancel Booking (Protected)
PATCH /bookings/:id
🔒 Authentication Flow
JWT token generated on login / google login
Token required for protected routes
Token sent via:
Authorization: Bearer <token>
🧠 Features Explanation
🔹 Google Login

Uses Google OAuth token verification via:

https://www.googleapis.com/oauth2/v3/userinfo
🔹 Security
Passwords hashed using bcrypt
JWT expiration: 7 days
Route protection middleware implemented
🧪 Example Booking Object
{
  "tutorId": "123",
  "tutorName": "John Doe",
  "tutorPhoto": "https://image-url.com",
  "studentName": "Student Name",
  "phone": "0123456789",
  "specialNote": "Need evening class"
}
🐛 Common Fixes
Invalid ObjectId handled safely
Duplicate booking prevention supported (frontend logic)
Google login fallback photo handling:
booking.tutorPhoto ?? booking.tutorPhotoUrl ?? ''
👨‍💻 Author

Inju muju

# Rental Hub

A full-stack equipment rental marketplace with an Express/MongoDB API and a React/Vite client.

## Features

- JWT-based authentication
- Product listing and management
- Category tree browsing
- Hourly, daily, and weekly rental pricing
- Nearby product search with coordinate-based filtering
- Booking lifecycle with Razorpay payment and refund handling
- Featured and trending homepage merchandising

## Tech Stack

- Backend: Node.js, Express.js, MongoDB, Mongoose, Joi
- Frontend: React, Vite, Redux Toolkit, Tailwind CSS

## Project Structure

```text
Rental Hub/
|-- Server/
|   |-- config/
|   |-- controllers/
|   |-- middleware/
|   |-- models/
|   |-- routes/
|   |-- Services/
|   |-- utils/
|   |-- validation/
|   `-- server.js
|-- Client/
|   |-- public/
|   `-- src/
|-- package.json
`-- README.md
```

## Installation

1. Install backend dependencies from the repo root:

```bash
npm install
```

2. Install frontend dependencies:

```bash
cd Client
npm install
```

3. Copy `Server/.env.example` to `Server/.env`, then fill in your values:

```bash
cd Server
copy .env.example .env
```

Use these keys in `Server/.env`:

```env
PORT=5000
MONGO_URI=your_mongodb_url
JWT_SECRET=your_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
NODE_ENV=development
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Product image uploads use Cloudinary via `POST /api/v1/uploads/products` and return hosted image URLs plus Cloudinary public IDs.

## Run

Start the API from the repo root:

```bash
npm run server
```

Start the client from `Client/`:

```bash
npm run dev
```

## Useful Commands

- `cd Client && npm run lint`
- `cd Client && npm run build`
- `npm run server`

## Current Status

- Backend API is wired for users, categories, and products.
- Frontend includes auth screens, homepage, product listing flow, nearby search, and pricing-mode aware booking.
- Bookings, Razorpay payment verification, and refund execution are wired.
- Real-time chat and price negotiation are available.
- Reviews are still pending.

## Author

Salih P

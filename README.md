# 🔢 Number System Practice & Conversion Master

An interactive, web-based platform designed to help students, developers, and computer science enthusiasts master **Number System Conversions** (Binary, Octal, Decimal, Hexadecimal, Base-16, Base-32) and bitwise operations through hands-on practice, quizzes, and live global rankings.

---

## 🌟 Key Features

- **🔐 Authenticated & Cloud-Synced Progress**
  - Seamless authentication via Google Sign-In or Email/Password.
  - Full multi-tenant data isolation per user account using Firebase Authentication & Cloud Firestore.
  - Automatic cloud syncing for scores, streaks, and solved problem counts.

- **🧮 Interactive Bit Manipulator & Converter (`index1.html`)**
  - Interactive visual bit toggle boxes with customizable bit width (4 to 32 bits).
  - Real-time conversion across Binary, Octal, Decimal, Hexadecimal, and higher bases.
  - Step-by-step mathematical breakdown for every conversion.

- **🎯 Conversion Quiz Arena (`number-system-quiz.html`)**
  - Target practice mode testing direct conversions between any two number systems.
  - Balanced scoring system with level multipliers, speed bonuses, and streak rewards (+5 to +15 pts max).
  - Immediate feedback on correct or incorrect attempts.

- **🏆 Global Live Leaderboard**
  - Real-time leaderboard powered by Cloud Firestore.
  - Compete globally with top learners ranked by total points, max streaks, and solved questions.

- **📓 Error Notebook & Attempt History**
  - Automatic error tracking for missed questions to enable targeted retries.
  - Solved history log with timestamps and performance analytics.

- **📱 Fully Responsive & Mobile Optimized**
  - Touch-friendly interface with tailored layouts for smartphones and tablets.
  - Smooth transitions, clean dark theme aesthetic, and zero iOS auto-zoom input disruptions.

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3 (CSS Variables, Flexbox, Grid, Media Queries), Vanilla JavaScript (ES6+)
- **Backend & Persistence:** Firebase Auth, Cloud Firestore (Compat SDK v10)
- **Server Environment:** Express / Node.js static server

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)

### Installation & Local Run
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/Number_System.git
   cd Number_System
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the application:
   ```bash
   npm start
   ```
4. Open your browser and navigate to `http://localhost:3000`.

-----

## 📁 Project Structure

```
.
├── index.html               # Authentication & Welcome Portal (Login / Sign Up)
├── index1.html              # Main Interactive Practice Arena & Dashboard
├── number-system-quiz.html  # Dedicated Conversion Quiz Arena
├── script.js                # Core Application Logic, Firebase Sync & State Engine
├── style.css                # Global Design System & Responsive Styles
├── server.js                # Express Dev Server
└── metadata.json            # Application Metadata
```

---

## 🤝 Contributing

Contributions, feature suggestions, and bug reports are welcome! Feel free to open an issue or submit a pull request.

# No Second Best ₿

An AR webcam-controlled game where you defend Bitcoin from altcoins! Shoot altcoins with finger guns, eat Bitcoin with your mouth for power-ups, and become Michael Saylor himself. Built with React, TypeScript, and MediaPipe Vision.

<div align="center">
  <img src="https://img.shields.io/badge/React-19.2.3-blue" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.8.2-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6.2.0-yellow" alt="Vite" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4.0-blue" alt="TailwindCSS" />
</div>

## 🎮 Features

- **AR Camera Integration**: Real-time face and hand detection using MediaPipe Vision
- **Bitcoin vs Altcoins**: Defend against waves of attacking altcoins seeking to challenge Bitcoin's supremacy
- **Bitcoin Power-Ups**: Eat Bitcoin with your mouth for hero sound activation and massive bonuses
- **Michael Saylor Face Overlay**: Transform into the legendary Bitcoin champion with face overlay
- **Single Player Mode**: Protect Bitcoin from the altcoin invasion
- **Dynamic Difficulty**: Altcoins spawn faster and move quicker as you progress
- **Screenshot Sharing**: Capture and share your heroic Bitcoin defense moments
- **Social Integration**: Easy sharing with automatic image + text clipboard copy
- **High Score Tracking**: Compete against your personal best score

## 🚀 Run Locally

**Prerequisites:** Node.js 18+

1. **Clone and install:**
   ```bash
   git clone <your-repo-url>
   cd no-second-best
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser** to `http://localhost:5173`

> **Note:** This app requires camera access to work. Allow camera permissions when prompted.

## 📱 How to Play

1. **Allow Camera Access** - The game needs your camera to detect faces and hands
2. **Get in Frame** - Center your face and raise your index fingers
3. **Shoot Altcoins!** - Point your index fingers at attacking altcoins to shoot them down
4. **Eat Bitcoin!** - Open your mouth wide to consume Bitcoin power-ups for massive bonuses and the legendary hero sound
5. **Protect Your Face** - Don't let altcoins touch your face or you'll lose lives
6. **Survive & Score** - The game gets harder as you progress. How long can you defend Bitcoin?

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **AI Vision**: MediaPipe Tasks Vision
- **Icons**: Lucide React
- **Audio**: Web Audio API

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect to Vercel:**
   - Push your code to GitHub
   - Connect your GitHub repo to Vercel
   - Vercel will automatically deploy using the included configuration

2. **Manual Deployment:**
   ```bash
   npm install -g vercel
   vercel --prod
   ```

### Environment Variables

For production deployment, you may want to set:
- `VERCEL_URL` - Your Vercel deployment URL (auto-generated)

## 📊 GitHub Actions

This project includes automated deployment via GitHub Actions. The workflow:

- Triggers on pushes to `main`/`master` branches
- Installs dependencies
- Builds the project
- Deploys to Vercel automatically

**Required Secrets** (set in your GitHub repo):
- `VERCEL_TOKEN` - Your Vercel API token
- `VERCEL_ORG_ID` - Your Vercel organization ID
- `VERCEL_PROJECT_ID` - Your Vercel project ID

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🎨 Assets

For better social sharing, create an `og-image.png` (1200x630) file in your `public/` directory with your game's branding.

---

**Made with ❤️ for Bitcoin Maximalists Everywhere**

*There is no second best.*

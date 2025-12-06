
# MediBot - AI Health Assistant 🩺

MediBot is an intelligent, real-time AI health assistant designed to provide medical information and support through both text and voice interactions. Built with React, Vite, and Google's powerful Gemini API, it features a modern, accessible UI with full Dark Mode support.

![Status](https://img.shields.io/badge/Status-Active-success)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Key Features

- **💬 AI Chat Interface**: 
  - Chat naturally with the AI about health concerns.
  - **Image Analysis**: Upload medical reports or images for analysis.
  - **Streaming Responses**: Fast, real-time text streaming.
  - **Markdown Support**: Rich text formatting for medical advice.

- **🎙️ Real-time Voice Mode**:
  - **Live Bidirectional Voice**: Speak to MediBot naturally and receive instant voice responses.
  - **Visualizer**: Dynamic audio visualizer for an immersive experience.
  - **Hands-free**: Ideal for accessibility and quick interactions.

- **🌗 Modern UI & Accessibility**:
  - **Dark/Light Mode**: Fully theme-aware UI with a seamless toggle.
  - **Bilingual Support**: Native support for **English** and **Sinhala**.
  - **Responsive Design**: Works perfectly on desktop and mobile devices.

- **⚡ Core Utilities**:
  - **Emergency Actions**: Quick access to emergency numbers (1990).
  - **Local History**: Chat and voice session history persisted locally.
  - **Health Profile**: Save your medical context (allergies, conditions) for personalised AI responses.

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS (CDN-based for flexibility)
- **AI Integration**: Google GenAI SDK (`@google/genai`)
- **Icons**: Lucide React
- **State Management**: React Hooks & LocalStorage

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A valid **Google Gemini API Key**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kavishka-CodXlab/medibot.git
   cd medibot
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env.local` file in the root directory and add your API Key:
   ```env
   VITE_GEMINI_API_KEY=your_google_ai_studio_api_key_here
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) (or the port shown in your terminal) to view the app.

## 📱 Usage Guide

1. **Setup Profile**: Click the user icon in the header to set up your age, gender, and medical conditions for better context.
2. **Start Chatting**: Type your symptoms or health questions in the main chat via.
3. **Upload Images**: Use the image icon to upload photos of skin conditions, reports, or medicine labels for identification.
4. **Voice Mode**: Click the **"Live Voice"** tab and grant microphone permissions to talk to MediBot in real-time.
5. **Switch Theme**: Use the Sun/Moon icon in the top right to toggle between Light and Dark modes.
6. **Change Language**: Use the language dropdown to switch between English and Sinhala.

## ⚠️ Disclaimer

**MediBot is an AI assistant and does not replace professional medical advice.** Always consult a qualified healthcare provider for diagnosis or treatment of any medical condition. In case of emergency, contact your local emergency services immediately.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).



Designed & Developed Innovative Solutions  By Kavishka Thilakarathna©️

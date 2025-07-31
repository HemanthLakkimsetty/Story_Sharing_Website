# ShareYourStory

A simple web platform to share and read stories, with support for chapters, user authentication, comments, likes, notifications, and more.

## Features
- User signup, login, and logout
- Share stories with multiple chapters/episodes
- View counts (unique, logged-in readers only)
- Like/favorite stories and chapters
- Comment on stories and chapters
- Edit/delete your own stories and chapters
- User profile pages
- Story tags and categories with filtering
- Search by title, author, or category
- Notifications for authors (comments, likes)
- Light/Dark mode toggle

## Tech Stack
- **Backend:** Node.js, Express.js
- **Frontend:** EJS templates, CSS
- **Authentication:** express-session, bcryptjs
- **Data Storage:** In-memory (for demo purposes)

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v14 or higher recommended)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/shareyourstory.git
   cd shareyourstory
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   node server.js
   ```
4. Open your browser and go to [http://localhost:3000](http://localhost:3000)

## Project Structure
```
/ (project root)
  |-- server.js
  |-- package.json
  |-- /views         # EJS templates
  |-- /public        # Static assets (if any)
  |-- .gitignore
  |-- README.md
```

## Usage
- Sign up for a new account or log in.
- Share a new story using the plus (+) button.
- Add chapters, edit or delete your stories/chapters.
- Like, comment, and search for stories.
- Switch between light and dark mode using the toggle in the top bar.

## Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

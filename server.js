const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session setup
app.use(session({
  secret: 'storyweb_secret',
  resave: false,
  saveUninitialized: false
}));

// In-memory data structure for users, stories, and chapters
let users = [];
let stories = [];
const CATEGORIES = ['Adventure', 'Romance', 'Fantasy', 'Horror', 'Sci-Fi', 'Mystery', 'Drama', 'Comedy', 'Other'];
const STORIES_PER_PAGE = 5;
function getSortedStories(stories, sort) {
  if (sort === 'views') {
    return [...stories].sort((a, b) => (b.views || 0) - (a.views || 0));
  } else if (sort === 'likes') {
    return [...stories].sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
  } else {
    // newest
    return [...stories].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
}
function paginate(stories, page) {
  const start = (page - 1) * STORIES_PER_PAGE;
  return stories.slice(start, start + STORIES_PER_PAGE);
}

// Helper: get user by username
function getUser(username) {
  return users.find(u => u.username === username);
}
// Add notification to a user
function addNotification(username, message) {
  const user = getUser(username);
  if (!user) return;
  user.notifications = user.notifications || [];
  user.notifications.unshift({ message, timestamp: new Date(), read: false });
}

// Track reading progress for users
function markChaptersRead(username, storyId, chapterCount) {
  const user = getUser(username);
  if (!user) return;
  user.readingProgress = user.readingProgress || {};
  user.readingProgress[storyId] = user.readingProgress[storyId] || [];
  for (let i = 0; i < chapterCount; i++) {
    if (!user.readingProgress[storyId].includes(i)) {
      user.readingProgress[storyId].push(i);
    }
  }
}

// Middleware to make user info available to all views
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  if (req.session.user) {
    const u = getUser(req.session.user.username);
    u.notifications = u.notifications || [];
    res.locals.unreadNotifications = u.notifications.filter(n => !n.read).length;
  } else {
    res.locals.unreadNotifications = 0;
  }
  next();
});

// Home page: list all stories and form to create a new story
app.get('/', (req, res) => {
  res.render('index', { stories, search: '', categories: CATEGORIES, filterTag: null, filterCategory: null });
});

// Search route
app.get('/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const author = (req.query.author || '').toLowerCase();
  const category = req.query.category || '';
  let filtered = stories.filter(story => {
    if (q && !story.title.toLowerCase().includes(q)) return false;
    if (author && story.author.toLowerCase() !== author) return false;
    if (category && story.category !== category) return false;
    return true;
  });
  res.render('index', {
    stories: filtered,
    search: req.query.q || '',
    author: req.query.author,
    category: req.query.category,
    categories: CATEGORIES,
    filterTag: null,
    filterCategory: null
  });
});

// Signup page
app.get('/signup', (req, res) => {
  res.render('signup', { error: null });
});

app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('signup', { error: 'All fields are required.' });
  }
  if (users.find(u => u.username === username)) {
    return res.render('signup', { error: 'Username already exists.' });
  }
  const hashed = await bcrypt.hash(password, 10);
  users.push({ username, password: hashed, joinDate: new Date() });
  res.redirect('/login');
});

// Login page
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) {
    return res.render('login', { error: 'Invalid username or password.' });
  }
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.render('login', { error: 'Invalid username or password.' });
  }
  req.session.user = { username };
  res.redirect('/');
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Middleware to protect routes
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

// Create a new story (only for logged-in users)
app.post('/story', requireLogin, (req, res) => {
  const { author, title, tags, category } = req.body;
  if (author && title) {
    stories.unshift({
      author,
      title,
      chapters: [],
      views: 0,
      viewers: [],
      timestamp: new Date(),
      tags: (tags || '').split(',').map(t => t.trim()).filter(Boolean),
      category: category || 'Other',
    });
  }
  res.redirect('/');
});

// View a story and its chapters, and form to add a new chapter
app.get('/story/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const story = stories[id];
  if (!story) return res.status(404).send('Story not found');
  // Only increment views if user is logged in and not the author, and hasn't viewed before
  if (
    req.session.user &&
    req.session.user.username !== story.author &&
    (!story.viewers || !story.viewers.includes(req.session.user.username))
  ) {
    story.views = (story.views || 0) + 1;
    story.viewers = story.viewers || [];
    story.viewers.push(req.session.user.username);
    story.chapters.forEach(chapter => {
      chapter.views = (chapter.views || 0) + 1;
      chapter.viewers = chapter.viewers || [];
      if (!chapter.viewers.includes(req.session.user.username)) {
        chapter.viewers.push(req.session.user.username);
      }
    });
  }
  const isAuthor = req.session.user && req.session.user.username === story.author;
  // Mark all chapters as read for this user
  if (req.session.user) {
    markChaptersRead(req.session.user.username, id, story.chapters.length);
  }
  // Get reading progress for this user
  let progress = null;
  if (req.session.user) {
    const user = getUser(req.session.user.username);
    user.readingProgress = user.readingProgress || {};
    progress = user.readingProgress[id] || [];
  }
  res.render('story', { story, id, isAuthor, progress });
});

// Edit story form (only for author)
app.get('/story/:id/edit', requireLogin, (req, res) => {
  const id = parseInt(req.params.id);
  const story = stories[id];
  if (!story) return res.status(404).send('Story not found');
  if (req.session.user.username !== story.author) return res.status(403).send('Forbidden');
  res.render('edit_story', { story, id, error: null, categories: CATEGORIES });
});

// Handle edit story (only for author)
app.post('/story/:id/edit', requireLogin, (req, res) => {
  const id = parseInt(req.params.id);
  const story = stories[id];
  if (!story) return res.status(404).send('Story not found');
  if (req.session.user.username !== story.author) return res.status(403).send('Forbidden');
  const { title, tags, category } = req.body;
  if (!title) return res.render('edit_story', { story, id, error: 'Title is required.', categories: CATEGORIES });
  story.title = title;
  story.tags = (tags || '').split(',').map(t => t.trim()).filter(Boolean);
  story.category = category || 'Other';
  res.redirect(`/story/${id}`);
});

// Delete story (only for author)
app.post('/story/:id/delete', requireLogin, (req, res) => {
  const id = parseInt(req.params.id);
  const story = stories[id];
  if (!story) return res.status(404).send('Story not found');
  if (req.session.user.username !== story.author) return res.status(403).send('Forbidden');
  stories.splice(id, 1);
  res.redirect('/');
});

// Add a chapter to a story (only for logged-in users)
app.post('/story/:id/chapter', requireLogin, (req, res) => {
  const id = parseInt(req.params.id);
  const story = stories[id];
  if (!story) return res.status(404).send('Story not found');
  const { title, content } = req.body;
  if (title && content) {
    story.chapters.push({ title, content, views: 0, viewers: [], timestamp: new Date() });
  }
  res.redirect(`/story/${id}`);
});

// Edit chapter form (only for story author)
app.get('/story/:storyId/chapter/:chapterId/edit', requireLogin, (req, res) => {
  const storyId = parseInt(req.params.storyId);
  const chapterId = parseInt(req.params.chapterId);
  const story = stories[storyId];
  if (!story) return res.status(404).send('Story not found');
  if (req.session.user.username !== story.author) return res.status(403).send('Forbidden');
  const chapter = story.chapters[chapterId];
  if (!chapter) return res.status(404).send('Chapter not found');
  res.render('edit_chapter', { story, chapter, storyId, chapterId, error: null });
});

// Handle edit chapter (only for story author)
app.post('/story/:storyId/chapter/:chapterId/edit', requireLogin, (req, res) => {
  const storyId = parseInt(req.params.storyId);
  const chapterId = parseInt(req.params.chapterId);
  const story = stories[storyId];
  if (!story) return res.status(404).send('Story not found');
  if (req.session.user.username !== story.author) return res.status(403).send('Forbidden');
  const chapter = story.chapters[chapterId];
  if (!chapter) return res.status(404).send('Chapter not found');
  const { title, content } = req.body;
  if (!title || !content) return res.render('edit_chapter', { story, chapter, storyId, chapterId, error: 'All fields are required.' });
  chapter.title = title;
  chapter.content = content;
  res.redirect(`/story/${storyId}`);
});

// Delete chapter (only for story author)
app.post('/story/:storyId/chapter/:chapterId/delete', requireLogin, (req, res) => {
  const storyId = parseInt(req.params.storyId);
  const chapterId = parseInt(req.params.chapterId);
  const story = stories[storyId];
  if (!story) return res.status(404).send('Story not found');
  if (req.session.user.username !== story.author) return res.status(403).send('Forbidden');
  if (!story.chapters[chapterId]) return res.status(404).send('Chapter not found');
  story.chapters.splice(chapterId, 1);
  res.redirect(`/story/${storyId}`);
});

// Add comment to a story
app.post('/story/:id/comment', requireLogin, (req, res) => {
  const id = parseInt(req.params.id);
  const story = stories[id];
  if (!story) return res.status(404).send('Story not found');
  const { content } = req.body;
  if (!content) return res.redirect(`/story/${id}`);
  story.comments = story.comments || [];
  story.comments.push({
    author: req.session.user.username,
    content,
    timestamp: new Date()
  });
  if (story.author !== req.session.user.username) {
    addNotification(story.author, `${req.session.user.username} commented on your story "${story.title}"`);
  }
  res.redirect(`/story/${id}`);
});

// Add comment to a chapter
app.post('/story/:id/chapter/:chapterId/comment', requireLogin, (req, res) => {
  const id = parseInt(req.params.id);
  const chapterId = parseInt(req.params.chapterId);
  const story = stories[id];
  if (!story) return res.status(404).send('Story not found');
  const chapter = story.chapters[chapterId];
  if (!chapter) return res.status(404).send('Chapter not found');
  const { content } = req.body;
  if (!content) return res.redirect(`/story/${id}`);
  chapter.comments = chapter.comments || [];
  chapter.comments.push({
    author: req.session.user.username,
    content,
    timestamp: new Date()
  });
  if (story.author !== req.session.user.username) {
    addNotification(story.author, `${req.session.user.username} commented on a chapter of your story "${story.title}"`);
  }
  res.redirect(`/story/${id}`);
});

// Like/unlike a story
app.post('/story/:id/like', requireLogin, (req, res) => {
  const id = parseInt(req.params.id);
  const story = stories[id];
  if (!story) return res.status(404).send('Story not found');
  story.likes = story.likes || [];
  if (!story.likes.includes(req.session.user.username)) {
    story.likes.push(req.session.user.username);
    if (story.author !== req.session.user.username) {
      addNotification(story.author, `${req.session.user.username} liked your story "${story.title}"`);
    }
  }
  res.redirect(`/story/${id}`);
});
app.post('/story/:id/unlike', requireLogin, (req, res) => {
  const id = parseInt(req.params.id);
  const story = stories[id];
  if (!story) return res.status(404).send('Story not found');
  story.likes = story.likes || [];
  story.likes = story.likes.filter(u => u !== req.session.user.username);
  res.redirect(`/story/${id}`);
});
// Like/unlike a chapter
app.post('/story/:id/chapter/:chapterId/like', requireLogin, (req, res) => {
  const id = parseInt(req.params.id);
  const chapterId = parseInt(req.params.chapterId);
  const story = stories[id];
  if (!story) return res.status(404).send('Story not found');
  const chapter = story.chapters[chapterId];
  if (!chapter) return res.status(404).send('Chapter not found');
  chapter.likes = chapter.likes || [];
  if (!chapter.likes.includes(req.session.user.username)) {
    chapter.likes.push(req.session.user.username);
    if (story.author !== req.session.user.username) {
      addNotification(story.author, `${req.session.user.username} liked a chapter of your story "${story.title}"`);
    }
  }
  res.redirect(`/story/${id}`);
});
app.post('/story/:id/chapter/:chapterId/unlike', requireLogin, (req, res) => {
  const id = parseInt(req.params.id);
  const chapterId = parseInt(req.params.chapterId);
  const story = stories[id];
  if (!story) return res.status(404).send('Story not found');
  const chapter = story.chapters[chapterId];
  if (!chapter) return res.status(404).send('Chapter not found');
  chapter.likes = chapter.likes || [];
  chapter.likes = chapter.likes.filter(u => u !== req.session.user.username);
  res.redirect(`/story/${id}`);
});

// Filter by tag
app.get('/tag/:tag', (req, res) => {
  const tag = req.params.tag;
  const filtered = stories.filter(story => (story.tags || []).includes(tag));
  res.render('index', { stories: filtered, search: '', categories: CATEGORIES, filterTag: tag, filterCategory: null });
});
// Filter by category
app.get('/category/:category', (req, res) => {
  const category = req.params.category;
  const filtered = stories.filter(story => story.category === category);
  res.render('index', { stories: filtered, search: '', categories: CATEGORIES, filterTag: null, filterCategory: category });
});

// User profile page
app.get('/user/:username', (req, res) => {
  const username = req.params.username;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).send('User not found');
  // Add _index property to userStories for correct linking
  const userStories = stories
    .map((s, i) => ({ ...s, _index: i }))
    .filter(s => s.author === username);
  const totalViews = userStories.reduce((sum, s) => sum + (s.views || 0), 0);
  res.render('profile', {
    user,
    userStories,
    totalViews,
    isSelf: req.session.user && req.session.user.username === username
  });
});

// Edit author name form (only for self)
app.get('/user/:username/edit', requireLogin, (req, res) => {
  const username = req.params.username;
  if (req.session.user.username !== username) return res.status(403).send('Forbidden');
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).send('User not found');
  res.render('edit_author', { user, error: null, success: null });
});

// Handle author name change
app.post('/user/:username/edit', requireLogin, (req, res) => {
  const username = req.params.username;
  if (req.session.user.username !== username) return res.status(403).send('Forbidden');
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).send('User not found');
  const { newUsername } = req.body;
  if (!newUsername || newUsername.trim().length < 3) {
    return res.render('edit_author', { user, error: 'Username must be at least 3 characters.', success: null });
  }
  if (users.find(u => u.username === newUsername)) {
    return res.render('edit_author', { user, error: 'Username already exists.', success: null });
  }
  // Update username in users
  user.username = newUsername;
  // Update session
  req.session.user.username = newUsername;
  // Update stories and chapters
  stories.forEach(story => {
    if (story.author === username) story.author = newUsername;
    story.chapters.forEach(chapter => {
      if (chapter.author === username) chapter.author = newUsername;
    });
    // Update comments
    (story.comments || []).forEach(comment => {
      if (comment.author === username) comment.author = newUsername;
    });
    story.chapters.forEach(chapter => {
      (chapter.comments || []).forEach(comment => {
        if (comment.author === username) comment.author = newUsername;
      });
    });
  });
  res.render('edit_author', { user, error: null, success: 'Username updated successfully!' });
});

// Notifications page
app.get('/notifications', requireLogin, (req, res) => {
  const user = getUser(req.session.user.username);
  user.notifications = user.notifications || [];
  res.render('notifications', { notifications: user.notifications });
});
// Mark all notifications as read
app.post('/notifications/read', requireLogin, (req, res) => {
  const user = getUser(req.session.user.username);
  user.notifications = user.notifications || [];
  user.notifications.forEach(n => n.read = true);
  res.redirect('/notifications');
});

// Reading progress page
app.get('/progress', requireLogin, (req, res) => {
  const user = getUser(req.session.user.username);
  user.readingProgress = user.readingProgress || {};
  res.render('progress', { stories, readingProgress: user.readingProgress });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
}); 
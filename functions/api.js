exports.handler = async function(event, context) {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { httpMethod, path } = event;
    
    // Simple API endpoints for demo
    if (httpMethod === 'GET' && path.includes('/api/stories')) {
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          stories: [
            {
              id: 1,
              title: 'The Lost City',
              author: 'Demo Author',
              category: 'Adventure',
              views: 150,
              likes: 25,
              description: 'An adventure story about discovering ancient ruins in the Amazon jungle.'
            },
            {
              id: 2,
              title: 'Starlight Dreams',
              author: 'Demo Author',
              category: 'Romance',
              views: 89,
              likes: 18,
              description: 'A romantic tale set in a world where dreams become reality under the stars.'
            },
            {
              id: 3,
              title: 'Cyber Detective',
              author: 'Demo Author',
              category: 'Sci-Fi',
              views: 203,
              likes: 42,
              description: 'A sci-fi mystery about solving crimes in a futuristic cyberpunk world.'
            }
          ]
        })
      };
    }

    if (httpMethod === 'POST' && path.includes('/api/login')) {
      const body = JSON.parse(event.body || '{}');
      
      // Demo login - in real app, you'd validate against database
      if (body.username && body.password) {
        return {
          statusCode: 200,
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: true,
            message: 'Login successful (demo)',
            user: {
              username: body.username,
              id: 1
            }
          })
        };
      }
    }

    // Default response
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'ShareYourStory API',
        status: 'running',
        note: 'This is a demo API for the static site version'
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
}; 
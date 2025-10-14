const OAuth = require('oauth-1.0a');

// Test OAuth implementation
const oauth = new OAuth({
    consumer: {
        key: 'test_key',
        secret: 'test_secret'
    },
    signature_method: 'PLAINTEXT'
});

const requestData = {
    url: 'https://api.discogs.com/oauth/request_token',
    method: 'POST',
    data: {
        oauth_callback: 'oob'
    }
};

try {
    const authData = oauth.authorize(requestData);
    const headers = oauth.toHeader(authData);

    console.log('OAuth authorization data:', authData);
    console.log('Headers:', headers);
    console.log('Authorization header:', headers.Authorization);
} catch (error) {
    console.error('OAuth test failed:', error);
}
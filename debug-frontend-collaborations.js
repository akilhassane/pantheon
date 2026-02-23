// Debug script to check frontend collaboration loading
// Run this in the browser console when logged in as the collaborator

console.log('=== FRONTEND COLLABORATION DEBUG ===');

// Check if user is logged in
const checkUser = async () => {
  try {
    const response = await fetch('http://localhost:3002/api/auth/user', {
      credentials: 'include'
    });
    const data = await response.json();
    console.log('Current user:', data);
    return data.user;
  } catch (error) {
    console.error('Failed to get user:', error);
    return null;
  }
};

// Check collaborations API
const checkCollaborations = async (userId) => {
  try {
    const response = await fetch(`http://localhost:3002/api/collaborations?userId=${userId}`, {
      credentials: 'include'
    });
    const data = await response.json();
    console.log('Collaborations API response:', data);
    return data;
  } catch (error) {
    console.error('Failed to get collaborations:', error);
    return null;
  }
};

// Run checks
(async () => {
  const user = await checkUser();
  if (user && user.id) {
    console.log('User ID:', user.id);
    await checkCollaborations(user.id);
  } else {
    console.log('No user logged in');
  }
})();

// URLs for the GraphQL API and authentication
// These URLs are used to fetch data and authenticate users
const GRAPHQL_URL = "https://zone01normandie.org/api/graphql-engine/v1/graphql";
const AUTH_URL = "https://zone01normandie.org/api/auth/signin";

// Updated GraphQL query to include event_user data
const FULL_STUDENT_QUERY = `
  query FullStudentStats {
    user {
      id
      login
      attrs
      auditRatio
      totalUp
      totalDown
      avatarUrl
      campus
      createdAt
      public {
        firstName
        lastName
        profile
      }
      transactions(
        where: {
          type: {_eq: "xp"}, 
          _and: [
            {path: {_nlike: "%piscine-go%"}},
          ]
        }, 
        order_by: {createdAt: asc}
      ) {
        id
        type
        amount
        objectId
        createdAt
        path
        object {
          name
          type
        }
      }
      transactions_aggregate(
        where: {
          type: {_eq: "xp"}, 
          _and: [
            {path: {_nlike: "%piscine-go%"}},
          ]
        }
      ) {
        aggregate {
          sum {
            amount
          }
        }
      }
      progresses(where: {isDone: {_eq: true}}, order_by: {updatedAt: desc}) {
        id
        objectId
        grade
        createdAt
        updatedAt
        path
        object {
          name
          type
        }
      }
      progresses_aggregate(where: {isDone: {_eq: true}}) {
        aggregate {
          count
        }
      }
      results(order_by: {updatedAt: desc}) {
        id
        objectId
        grade
        type
        createdAt
        updatedAt
        path
        object {
          name
          type
        }
      }
      audits {
        id
        grade
        createdAt
      }
      audits_aggregate {
        aggregate {
          count
          sum {
            grade
          }
        }
      }
    }
    event_user(where: {event: {path: {_eq: "/rouen/div-01"}}}) {
      level
      eventId
      userLogin
      event {
        path
      }
    }
  }
`;

// Function to execute GraphQL queries
async function executeGraphQLQuery(query, variables = {}) {
  let token = sessionStorage.getItem('authToken');
  console.log("Token exists:", !!token);
  
  if (!token) {
    window.location.href = 'login.html';
    return null;
  }
  
  // Remove quotes if they exist (as an extra precaution)
  if (token.startsWith('"') && token.endsWith('"')) {
    token = token.slice(1, -1);
    sessionStorage.setItem('authToken', token); // Update the stored token
    console.log("Removed quotes from token in storage");
  }

  try {
    console.log("Sending GraphQL request to:", GRAPHQL_URL);
    
    // For debugging, log the first 20 chars of the token
    console.log("Token preview:", token.substring(0, 20) + "...");
    
    const response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    console.log("GraphQL response status:", response.status);
    
    // Log the raw response text for debugging
    const responseText = await response.text();
    console.log("Raw response:", responseText.substring(0, 200) + "...");
    
    // Parse it as JSON
    const data = JSON.parse(responseText);
    
    if (data.errors) {
      console.error('GraphQL Errors:', data.errors);
      console.log("Error details:", {
        message: data.errors[0]?.message,
        path: data.errors[0]?.path,
        extensions: data.errors[0]?.extensions
      });
      return null;
    }
    
    return data.data;
  } catch (error) {
    console.error('Error executing GraphQL query:', error);
    return null;
  }
}

// Function to load all student data
async function loadStudentData() {
  const data = await executeGraphQLQuery(FULL_STUDENT_QUERY);
  if (data && data.user && data.user.length > 0) {
    // Access the first user in the array
    const userData = data.user[0];
    
    // Find the div-01 event user entry
    const div01Event = data.event_user.find(eu => 
      eu.userLogin === userData.login && 
      eu.event?.path === "/rouen/div-01"
    );
    
    // Add official level to userData
    userData.officialLevel = div01Event?.level || 0;
    
    // Now display the data with the official level
    displayStudentData(userData);
  } else {
    console.error('Failed to load student data');
  }
}

// Function to display student data in the UI
function displayStudentData(userData) {
  console.log('Student data loaded:', userData);
  
  // Update header with user name
  const h1 = document.querySelector('h1');
  h1.textContent = `Hello, ${userData.login}!`;
  
  // Populate sidebar with user info
  populateSidebar(userData);
  
  // Fill the data boxes
  populateXPBox(userData.transactions, userData.transactions_aggregate);
  populateProjectsBox(userData.progresses, userData.progresses_aggregate, userData.transactions);
  populateAuditsBox(userData.audits, userData.audits_aggregate, userData.auditRatio, userData.totalUp, userData.totalDown);
  
  // Generate graphs
  generateGraphs(userData);
}

// Add these functions to populate your UI sections
function populateSidebar(userData) {
  const sidebar = document.querySelector('.sidebar');
  
  console.log("User data for sidebar:", userData);
  
  // Filter transactions to exclude piscine exercises but include specific piscine-js entry
  const filteredTransactions = userData.transactions.filter(transaction => {
    const path = transaction.path || '';
    
    // Exact match for the main Piscine JS entry
    if (path === "/rouen/div-01/piscine-js") {
      return true;
    }
    
    // For other entries, exclude anything containing piscine-go or piscine-js
    return !path.includes('piscine-go') && !path.includes('piscine-js');
  });
  
  // Calculate total XP from filtered transactions (just for display)
  const totalXP = filteredTransactions.reduce((sum, transaction) => {
    return sum + (transaction.amount || 0);
  }, 0);
  
  console.log("Total XP (excluding piscine):", totalXP);
  
  // Use official level from event_user
  const level = userData.officialLevel || 0;
  
  // Get user information from attrs or public fields
  let userAttrs = {};
  try {
    // Check if attrs is already an object or a string that needs parsing
    userAttrs = typeof userData.attrs === 'string' ? JSON.parse(userData.attrs) : userData.attrs || {};
  } catch (e) {
    console.error("Error parsing user attrs:", e);
    userAttrs = {};
  }
  
  console.log("User attributes:", userAttrs);
  
  const firstName = userData.public?.firstName || userAttrs.firstName || '';
  const lastName = userData.public?.lastName || userAttrs.lastName || '';
  const fullName = firstName && lastName ? `${firstName} ${lastName}` : userData.login;
  
  const location = userAttrs.country || 'Not specified';
  const phoneNumber = userAttrs.Phone || 'Not specified';
  const dateOfBirth = userAttrs.dateOfBirth || 'Not specified';
  
  // Create user profile section - WITHOUT XP progress bar
  let html = `
    <div class="user-profile">
      <h2>User Information</h2>
      ${userData.avatarUrl ? `<img src="${userData.avatarUrl}" alt="Profile" class="avatar">` : ''}
      <p class="user-name"><strong>Username:</strong> ${userData.login}</p>
      <p class="user-fullname"><strong>Full Name:</strong> ${fullName}</p>
      <p class="user-level"><strong>Level:</strong> ${level}</p>
      <p class="user-total-xp"><strong>Total XP:</strong> ${totalXP.toLocaleString()}</p>
      <p class="user-location"><strong>Location:</strong> ${location}</p>
      <p class="user-phone"><strong>Phone:</strong> ${phoneNumber}</p>
      <p class="user-dob"><strong>Date of Birth:</strong> ${dateOfBirth}</p>
      <p class="user-campus"><strong>Campus:</strong> ${userData.campus || 'N/A'}</p>
      <p class="join-date"><strong>Joined:</strong> ${new Date(userData.createdAt).toLocaleDateString()}</p>
    </div>
    <div class="logout-container">
      <button id="logoutButton" class="logout-btn">Logout</button>
    </div>
  `;
  
  sidebar.innerHTML = html;
  
  // Add event listener to the logout button we just created
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', logout);
  }

  // Simplified styling - removed progress bar styles
  const style = document.createElement('style');
  style.textContent = `
    .user-profile p {
      margin: 10px 0;
      border-bottom: 1px solid #333;
      padding-bottom: 8px;
    }
    
    .avatar {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      margin: 10px auto;
      display: block;
      border: 3px solid #0097e6;
    }
    
    .user-name {
      font-size: 1.2em;
      font-weight: bold;
      color: #0097e6;
    }
    
    .user-total-xp {
      color: #2ecc71;
      font-weight: bold;
    }
  `;
  
  document.head.appendChild(style);
}

function populateXPBox(transactions, aggregate) {
  const xpBox = document.querySelector('.data-box:nth-child(1)');
  
  // Get XP data from transactions
  // Filter transactions to exclude piscine exercises (except the one ending with /piscine-js)
  const filteredTransactions = transactions.filter(transaction => {
    const path = transaction.path || '';
    console.log("Transaction path:", path);
    
    // Exact match for the main Piscine JS entry
    if (path === "/rouen/div-01/piscine-js") {
      return true;
    }
    
    // For other entries, exclude anything containing piscine-go or piscine-js
    return !path.includes('piscine-go') && !path.includes('piscine-js');
  });
  
  // Calculate total XP
  const totalXP = filteredTransactions.reduce((sum, transaction) => {
    return sum + (transaction.amount || 0);
  }, 0);
  
  // Get the last 5 completed projects for recent activity
  const recentXP = filteredTransactions
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
    
  // Create XP breakdown by month
  const monthlyXP = {};
  filteredTransactions.forEach(transaction => {
    const date = new Date(transaction.createdAt);
    const month = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    if (!monthlyXP[month]) {
      monthlyXP[month] = 0;
    }
    
    monthlyXP[month] += transaction.amount || 0;
  });
  
  // Create the content for the box
  let html = `
    <h3>XP Statistics</h3>
    <div class="xp-stats">
      <p class="total-xp"><strong>Total XP:</strong> ${totalXP.toLocaleString()}</p>
      
      <div class="monthly-breakdown">
        <h4>Monthly Breakdown</h4>
        <ul>
  `;
  
  // Add monthly XP breakdown
  Object.keys(monthlyXP).sort().reverse().slice(0, 6).forEach(month => {
    html += `<li><span>${month}:</span> <span>${monthlyXP[month].toLocaleString()} XP</span></li>`;
  });
  
  html += `
        </ul>
      </div>
      
      <div class="recent-activity">
        <h4>Recent Activity</h4>
        <ul>
  `;
  
  // Add recent activities
  recentXP.forEach(transaction => {
    const date = new Date(transaction.createdAt).toLocaleDateString();
    const projectName = transaction.object?.name || 'Unknown Project';
    
    html += `
      <li>
        <div class="activity-entry">
          <span class="activity-name">${projectName}</span>
          <span class="activity-xp">+${transaction.amount.toLocaleString()} XP</span>
          <span class="activity-date">${date}</span>
        </div>
      </li>
    `;
  });
  
  html += `
        </ul>
      </div>
    </div>
  `;
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .xp-stats {
      text-align: left;
      padding: 10px;
    }
    
    .monthly-breakdown, .recent-activity {
      margin-top: 20px;
    }
    
    .monthly-breakdown ul, .recent-activity ul {
      list-style: none;
      padding: 0;
    }
    
    .monthly-breakdown li, .recent-activity li {
      margin-bottom: 8px;
      border-bottom: 1px solid #333;
      padding-bottom: 8px;
      display: flex;
      justify-content: space-between;
    }
    
    .activity-entry {
      display: flex;
      flex-direction: column;
      width: 100%;
    }
    
    .activity-name {
      font-weight: bold;
      color: #0097e6;
    }
    
    .activity-xp {
      color: #2ecc71;
    }
    
    .activity-date {
      font-size: 0.8em;
      color: #7f8c8d;
      text-align: right;
    }
    
    .total-xp {
      font-size: 1.2em;
      margin-bottom: 20px;
      border-bottom: 2px solid #0097e6;
      padding-bottom: 10px;
    }
  `;
  
  document.head.appendChild(style);
  xpBox.innerHTML = html;
}

function populateProjectsBox(progresses, aggregate, transactions) {
  const projectBox = document.querySelector('.data-box:nth-child(2)');
  
  // Calculate project statistics
  const completedProjects = progresses.filter(p => p.grade !== null);
  const totalProjects = completedProjects.length;
  
  // Create a map of projects that have XP associated with them
  const projectsWithXP = new Map();
  
  // Extract object IDs from transactions to identify successful projects
  transactions.forEach(transaction => {
    if (transaction.amount > 0 && transaction.objectId) {
      projectsWithXP.set(transaction.objectId, true);
    }
  });
  
  // Calculate passed vs failed projects based on XP
  const passedProjects = completedProjects.filter(p => projectsWithXP.has(p.objectId));
  const failedProjects = completedProjects.filter(p => !projectsWithXP.has(p.objectId));
  
  const passedPercentage = (passedProjects.length / totalProjects) * 100 || 0;
  const failedPercentage = (failedProjects.length / totalProjects) * 100 || 0;
  
  // Calculate average grade
  const totalGrade = completedProjects.reduce((sum, project) => sum + project.grade, 0);
  const averageGrade = totalGrade / totalProjects || 0;
  
  // Create SVG for donut chart
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const passedOffset = circumference * (1 - (passedPercentage / 100));
  const failedOffset = circumference * (1 - (failedPercentage / 100));
  
  // Sort by date (most recent first)
  const recentProjects = [...progresses]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5);
  
  // Create HTML content
  let html = `
    <h3>Project Statistics</h3>
    <div class="project-stats">
      <div class="chart-container">
        <svg width="180" height="180" viewBox="0 0 200 200" class="donut-chart">
          <!-- Background circle -->
          <circle cx="100" cy="100" r="${radius}" fill="transparent" stroke="#333" stroke-width="15" />
          
          <!-- Failed projects (red) -->
          <circle 
            cx="100" 
            cy="100" 
            r="${radius}" 
            fill="transparent" 
            stroke="#e74c3c" 
            stroke-width="15"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${failedOffset}"
            transform="rotate(-90 100 100)"
            class="donut-segment donut-segment-failed"
          />
          
          <!-- Passed projects (green) -->
          <circle 
            cx="100" 
            cy="100" 
            r="${radius}" 
            fill="transparent" 
            stroke="#2ecc71" 
            stroke-width="15"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${passedOffset}"
            transform="rotate(${-90 + (failedPercentage * 3.6)} 100 100)"
            class="donut-segment donut-segment-passed"
          />
          
          <!-- Center text -->
          <text x="100" y="95" text-anchor="middle" class="donut-text">
            ${passedPercentage.toFixed(0)}%
          </text>
          <text x="100" y="115" text-anchor="middle" class="donut-subtext">
            Success
          </text>
        </svg>
        
        <div class="chart-legend">
          <div class="legend-item">
            <span class="legend-color" style="background-color: #2ecc71;"></span>
            <span>Successful: ${passedProjects.length} (${passedPercentage.toFixed(1)}%)</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background-color: #e74c3c;"></span>
            <span>No XP: ${failedProjects.length} (${failedPercentage.toFixed(1)}%)</span>
          </div>
        </div>
      </div>
      
      <div class="project-summary">
        <div class="summary-item">
          <span class="summary-label">Completed Projects:</span>
          <span class="summary-value">${totalProjects}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Average Grade:</span>
          <span class="summary-value">${averageGrade.toFixed(1)}</span>
        </div>
      </div>
      
      <div class="recent-projects">
        <h4>Recent Projects</h4>
        <ul class="project-list">
  `;
  
  // Add recent projects
  recentProjects.forEach(project => {
    const projectName = project.object?.name || 'Unknown Project';
    const date = new Date(project.updatedAt).toLocaleDateString();
    const hasXP = projectsWithXP.has(project.objectId);
    const status = project.grade !== null ? 
      (hasXP ? 'Successful' : 'No XP') : 
      'In Progress';
    const statusColor = project.grade !== null ?
      (hasXP ? '#2ecc71' : '#e74c3c') :
      '#f39c12';
      
    html += `
      <li class="project-item">
        <div>
          <div class="project-name">${projectName}</div>
          <div class="project-date">${date}</div>
        </div>
        <div class="project-grade" style="color: ${statusColor}">
          ${project.grade !== null ? `Grade: ${project.grade}` : 'In Progress'}
          <span class="project-status">${status}</span>
        </div>
      </li>
    `;
  });
  
  html += `
        </ul>
      </div>
    </div>
  `;
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .project-stats {
      text-align: left;
      padding: 10px;
    }
    
    .chart-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .donut-chart {
      max-width: 160px;
      margin: 0 auto;
    }
    
    .donut-text {
      font-size: 24px;
      font-weight: bold;
      fill: white;
    }
    
    .donut-subtext {
      font-size: 12px;
      fill: #bdc3c7;
    }
    
    .chart-legend {
      margin-top: 15px;
      display: flex;
      justify-content: center;
      gap: 15px;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    
    .legend-color {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    
    .project-summary {
      margin-bottom: 20px;
    }
    
    .summary-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid #333;
    }
    
    .project-list {
      list-style: none;
      padding: 0;
    }
    
    .project-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #333;
    }
    
    .project-name {
      font-weight: bold;
      color: #0097e6;
    }
    
    .project-grade {
      font-weight: bold;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    
    .project-status {
      font-size: 0.8em;
    }
    
    .project-date {
      color: #7f8c8d;
      font-size: 0.9em;
    }
    
    .recent-projects {
      margin-top: 20px;
    }
  `;
  
  document.head.appendChild(style);
  projectBox.innerHTML = html;
}

function populateAuditsBox(audits, aggregate, auditRatio, totalUp, totalDown) {
  const auditBox = document.querySelector('.data-box:nth-child(3)');
  
  // Get audit ratio and total XP values from parameters instead of userData
  
  // Determine color based on audit ratio
  let ratioColor, ratioMessage;
  if (auditRatio >= 1) {
    ratioColor = '#2ecc71'; // Green
    ratioMessage = "Excellent! You're contributing significantly to the community.";
  } else if (auditRatio >= 0.7 && auditRatio < 1) {
    ratioColor = '#f39c12'; // Orange
    ratioMessage = "Good job! Try auditing a few more projects to improve your ratio.";
  } else {
    ratioColor = '#e74c3c'; // Red
    ratioMessage = "You should focus on auditing more projects to improve your ratio.";
  }
  
  // Calculate percentage for the display bars (max 100%)
  const receivedBarWidth = Math.min(auditRatio * 100, 100);
  
  // Create HTML content
  let html = `
    <h3>Audit Activity</h3>
    <div class="audit-stats">
      <div class="audit-ratio-container">
        <p class="ratio-value">Audit Ratio: <strong style="color: ${ratioColor}">${auditRatio.toFixed(2)}</strong></p>
        <div class="ratio-message">${ratioMessage}</div>
        
        <div class="ratio-bars">
          <div class="ratio-label">XP Given: ${totalDown.toLocaleString()}</div>
          <div class="ratio-bar given-bar">
            <div class="ratio-fill given-fill" style="width: 100%"></div>
          </div>
          
          <div class="ratio-label">XP Received: ${totalUp.toLocaleString()}</div>
          <div class="ratio-bar received-bar">
            <div class="ratio-fill received-fill" style="width: ${receivedBarWidth}%; background-color: ${ratioColor};"></div>
          </div>
        </div>
      </div>
      
      <div class="audit-summary">
        <div class="summary-item">
          <span class="summary-label">Total Audits Done:</span>
          <span class="summary-value">${aggregate.aggregate.count}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Average Grade Given:</span>
          <span class="summary-value">${(aggregate.aggregate.sum.grade / aggregate.aggregate.count).toFixed(1)}</span>
        </div>
      </div>
      
      <div class="recent-audits">
        <h4>Recent Audits</h4>
        <ul class="audit-list">
  `;
  
  // Add the 5 most recent audits
  audits.slice(0, 5).forEach(audit => {
    const date = new Date(audit.createdAt).toLocaleDateString();
    html += `
      <li class="audit-item">
        <div class="audit-grade">Grade: ${audit.grade}</div>
        <div class="audit-date">${date}</div>
      </li>
    `;
  });
  
  html += `
        </ul>
      </div>
    </div>
  `;
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .audit-stats {
      text-align: left;
      padding: 10px;
    }
    
    .audit-ratio-container {
      margin-bottom: 20px;
      padding: 15px;
      background: rgba(0,0,0,0.2);
      border-radius: 10px;
    }
    
    .ratio-value {
      font-size: 1.2em;
      margin-bottom: 5px;
    }
    
    .ratio-message {
      font-style: italic;
      margin-bottom: 15px;
      color: #bdc3c7;
    }
    
    .ratio-bars {
      margin-top: 20px;
    }
    
    .ratio-label {
      margin-bottom: 5px;
      font-size: 0.9em;
      color: #ecf0f1;
    }
    
    .ratio-bar {
      height: 20px;
      background: rgba(0,0,0,0.2);
      border-radius: 10px;
      margin-bottom: 15px;
      overflow: hidden;
    }
    
    .ratio-fill {
      height: 100%;
      border-radius: 10px;
    }
    
    .given-fill {
      background-color: #3498db;
    }
    
    .audit-summary {
      margin-bottom: 20px;
    }
    
    .summary-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid #333;
    }
    
    .audit-list {
      list-style: none;
      padding: 0;
    }
    
    .audit-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #333;
    }
    
    .audit-grade {
      font-weight: bold;
    }
    
    .audit-date {
      color: #7f8c8d;
      font-size: 0.9em;
    }
  `;
  
  document.head.appendChild(style);
  auditBox.innerHTML = html;
}

function generateGraphs(userData) {
  const graphBox = document.querySelector('.graph-box');
  
  // Filter transactions as you've done elsewhere
  const filteredTransactions = userData.transactions.filter(transaction => {
    const path = transaction.path || '';
    if (path === "/rouen/div-01/piscine-js") {
      return true;
    }
    return !path.includes('piscine-go') && !path.includes('piscine-js');
  });
  
  // Sort by date
  const sortedTransactions = [...filteredTransactions].sort((a, b) => 
    new Date(a.createdAt) - new Date(b.createdAt)
  );
  
  // Calculate cumulative XP over time
  let cumulativeXP = 0;
  const dataPoints = sortedTransactions.map(transaction => {
    cumulativeXP += transaction.amount || 0;
    return {
      date: new Date(transaction.createdAt),
      xp: cumulativeXP
    };
  });
  
  // Only keep points that represent significant changes (to reduce data points)
  const significantPoints = dataPoints.filter((point, index) => {
    if (index === 0 || index === dataPoints.length - 1) return true;
    const xpChange = point.xp - dataPoints[index - 1].xp;
    return xpChange > 1000; // Only show points with significant XP changes
  });
  
  // Create SVG
  const margin = { top: 40, right: 40, bottom: 60, left: 80 };
  const width = graphBox.clientWidth - margin.left - margin.right;
  const height = graphBox.clientHeight - margin.top - margin.bottom - 60; // Leave space for title
  
  // Find min/max values for scaling
  const dateMin = significantPoints[0].date;
  const dateMax = significantPoints[significantPoints.length - 1].date;
  const xpMax = Math.ceil(significantPoints[significantPoints.length - 1].xp / 10000) * 10000;
  
  // Create SVG container
  let svg = `
    <h3>XP Progress Over Time</h3>
    <svg width="${width + margin.left + margin.right}" height="${height + margin.top + margin.bottom}">
      <g transform="translate(${margin.left}, ${margin.top})">
  `;
  
  // Add axes
  svg += `
    <!-- X-axis (time) -->
    <line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="#666" stroke-width="2" />
    
    <!-- Y-axis (XP) -->
    <line x1="0" y1="0" x2="0" y2="${height}" stroke="#666" stroke-width="2" />
    
    <!-- X-axis labels -->
    <text x="${width/2}" y="${height + 40}" text-anchor="middle" fill="#fff">Time</text>
    
    <!-- Y-axis labels -->
    <text x="-40" y="${height/2}" text-anchor="middle" transform="rotate(-90, -40, ${height/2})" fill="#fff">XP</text>
  `;
  
  // Add grid lines and y-axis labels
  const yTickCount = 5;
  for (let i = 0; i <= yTickCount; i++) {
    const y = height - (i * height / yTickCount);
    const xpValue = Math.round(i * xpMax / yTickCount);
    
    svg += `
      <line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#333" stroke-width="1" stroke-dasharray="5,5" />
      <text x="-10" y="${y+5}" text-anchor="end" fill="#fff">${xpValue.toLocaleString()}</text>
    `;
  }
  
  // Create the path for the line chart
  let pathData = "M";
  significantPoints.forEach((point, i) => {
    const x = ((point.date - dateMin) / (dateMax - dateMin)) * width;
    const y = height - (point.xp / xpMax) * height;
    
    pathData += `${x} ${y}${i < significantPoints.length - 1 ? " L" : ""}`;
    
    // Add data points as circles
    svg += `<circle cx="${x}" cy="${y}" r="4" fill="#0097e6" />`;
  });
  
  // Add the line connecting all points
  svg += `<path d="${pathData}" stroke="#0097e6" stroke-width="3" fill="none" />`;
  
  // Close SVG
  svg += `
      </g>
    </svg>
  `;
  
  // Add SVG styles
  const style = document.createElement('style');
  style.textContent = `
    .graph-box svg {
      background: transparent;
      overflow: visible;
    }
    
    .graph-box text {
      font-size: 12px;
      font-family: sans-serif;
    }
    
    .graph-box circle:hover {
      r: 6;
      fill: #e74c3c;
      cursor: pointer;
      transition: r 0.2s, fill 0.2s;
    }
  `;
  
  document.head.appendChild(style);
  graphBox.innerHTML = svg;
  
  // Add tooltips for data points (optional enhancement)
  addTooltipsToGraph(graphBox, significantPoints, dateMin, dateMax, xpMax, width, height);
}

// Optional: Add tooltips to data points
function addTooltipsToGraph(graphBox, points, dateMin, dateMax, xpMax, width, height) {
  const circles = graphBox.querySelectorAll('circle');
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  tooltip.style.cssText = 'position: absolute; background: rgba(0,0,0,0.8); color: white; padding: 5px 10px; border-radius: 5px; font-size: 12px; pointer-events: none; opacity: 0; transition: opacity 0.2s;';
  document.body.appendChild(tooltip);
  
  circles.forEach((circle, i) => {
    circle.addEventListener('mouseover', (e) => {
      const date = points[i].date.toLocaleDateString();
      const xp = points[i].xp.toLocaleString();
      tooltip.innerHTML = `Date: ${date}<br>Total XP: ${xp}`;
      tooltip.style.opacity = '1';
      tooltip.style.left = `${e.pageX + 10}px`;
      tooltip.style.top = `${e.pageY - 30}px`;
    });
    
    circle.addEventListener('mouseout', () => {
      tooltip.style.opacity = '0';
    });
  });
}

// Add this helper function to check if a token is expired
function isTokenExpired(token) {
  try {
    // JWT tokens are split into three parts by dots
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    // Decode the middle part (payload)
    const payload = JSON.parse(atob(parts[1]));
    
    // Check if the token has an expiration time
    if (!payload.exp) return false;
    
    // Compare the expiration time with current time
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch (error) {
    // If any error occurs during parsing, consider the token invalid
    console.error('Error parsing token:', error);
    return true;
  }
}

function checkAuth() {
  const token = sessionStorage.getItem('authToken');
  const isLoginPage = window.location.pathname.includes('login.html') || 
                     window.location.pathname.endsWith('/');
  
  // Clean up invalid or expired tokens
  if (token) {
    // Check if token is properly formatted and not expired
    if (!token.includes('.') || token.split('.').length !== 3 || isTokenExpired(token)) {
      console.log('Found invalid or expired token, removing it');
      sessionStorage.removeItem('authToken');
      // If not on login page, we'll need to redirect after clearing the token
      if (!isLoginPage) {
        window.location.href = 'login.html';
        return false;
      }
    }
  }
  
  // Regular auth check
  if (!token && !isLoginPage) {
    // If no token and not on login page, redirect to login
    window.location.href = 'login.html';
    return false;
  } else if (token && isLoginPage) {
    // If has token and on login page, redirect to index
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

// This function will clear ALL tokens and storage data
function clearAllStorageData() {
  localStorage.clear();
  sessionStorage.clear();
  console.log('All storage data cleared');
}

// Handle login form submission
document.addEventListener('DOMContentLoaded', () => {
  // If the URL has a 'clear' parameter, clear all tokens first
  if (window.location.search.includes('clear=true')) {
    clearAllStorageData();
    // Remove the parameter from the URL
    const newUrl = window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  }
  
  checkAuth();
  
  const loginForm = document.querySelector('form.box');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  } else {
    // Set up logout button event listener
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
      logoutButton.addEventListener('click', logout);
    }
    
    loadStudentData();
  }
});

async function handleLogin(event) {
  event.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('pass').value;
  
  if (!username || !password) {
    alert('Please enter both username/email and password');
    return;
  }
  
  console.log("Attempting login for:", username);
  
  // Create Base64-encoded credentials
  const credentials = btoa(`${username}:${password}`);
  
  try {
    const response = await fetch(AUTH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    });
    
    console.log("Login response status:", response.status);
    
    if (response.ok) {
      // The response body IS the JWT token as text, not JSON
      let tokenText = await response.text();
      console.log("Full auth response:", tokenText);
      
      // Remove quotes if they exist
      if (tokenText.startsWith('"') && tokenText.endsWith('"')) {
        tokenText = tokenText.slice(1, -1);
        console.log("Removed quotes from token");
      }
      
      // Make sure it looks like a JWT (has 2 dots)
      if (tokenText && tokenText.includes('.') && tokenText.split('.').length === 3) {
        sessionStorage.setItem('authToken', tokenText);
        window.location.href = 'index.html';
      } else {
        console.log("Invalid token received:", tokenText);
        alert('Invalid authentication token received');
      }
    } else {
      // Error handling remains the same
      const errorText = await response.text();
      alert(`Login failed: ${errorText || 'Invalid credentials'}`);
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('Login failed due to a network error. Please try again.');
  }
}

function logout() {
  sessionStorage.removeItem('authToken');
  window.location.href = 'login.html';
}

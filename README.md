# GraphQL Dashboard

A streamlined visualization dashboard for Zone01 student data using the GraphQL API. This web application provides an interactive interface to view your progress, XP, projects, and audit statistics.

## Overview

This dashboard allows Zone01 students to visualize their educational progress through an intuitive interface. It connects to the Zone01 GraphQL API to retrieve and display personalized statistics in a visually appealing format.

## Features

- **Secure Authentication**: Login using Zone01's authentication API
- **User Profile**: Display personal information and profile details
- **XP Statistics**: View total XP, monthly breakdown, and recent XP activities
- **Project Stats**: Visual representation of successful vs. unsuccessful projects
- **Audit Activity**: Track your audit ratio, XP received and given through audits
- **Progress Graph**: Interactive line graph showing XP progression over time

## Technologies Used

- Vanilla JavaScript
- HTML5 & CSS3
- SVG for data visualization
- GraphQL for data fetching
- JWT authentication
- TailwindCSS for styling

## Installation

1. Clone this repository:
```bash
git clone https://github.com/nicgen/GraphQL.git
cd GraphQL
```
2. Install dependencies:
```bash
npm install
```
3. Start the development server:
```bash
npm run dev
```

## Usage

1. Open the application in your web browser
2. Log in with your Zone01 credentials
3. The dashboard will display your statistics:
   - Personal information and level progress in the sidebar
   - XP, Projects, and Audit statistics in the top section
   - XP progression over time in the graph section

## Security Notes

- Your credentials are never stored locally - only the JWT authentication token
- The token is automatically removed when logging out

## Data Visualization

The dashboard provides several visualization components:

1. **XP Progress Bar**: Shows progress to next level
2. **Project Success Circle**: Visual representation of project success rate
3. **Audit Ratio Bars**: Compare XP given vs. received in audits
4. **XP Timeline Graph**: Interactive chart showing XP growth over time

## License

This project is licensed under the MIT License.

## Acknowledgements

- Zone01 Normandie for providing the GraphQL API
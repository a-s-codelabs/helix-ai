<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Telescope from './Telescope.svelte';
  import { fn } from 'storybook/test';

  const { Story } = defineMeta({
    title: 'Telescope/Markdown',
    component: Telescope,
    tags: ['autodocs'],
    argTypes: {
      state: {
        control: { type: 'select' },
        options: ['ask', 'search'],
        description: 'Current state of the telescope component',
      },
      inputValue: {
        control: 'text',
        description: 'Current input value',
      },
      placeholder: {
        control: 'text',
        description: 'Placeholder text for the input',
      },
      searchIndex: {
        control: { type: 'number', min: 1, max: 50 },
        description: 'Current search result index',
      },
      totalResults: {
        control: { type: 'number', min: 1, max: 100 },
        description: 'Total number of search results',
      },
      suggestedQuestions: {
        control: 'object',
        description: 'Array of suggested questions',
      },
      disabled: {
        control: 'boolean',
        description: 'Whether the component is disabled',
      },
      messages: {
        control: 'object',
        description: 'Array of messages',
      },
    },
    args: {
      onInput: fn(),
      onAsk: fn(),
      onVoiceInput: fn(),
      onAttachment: fn(),
      onClear: fn(),
      onStateChange: fn(),
      onSuggestedQuestion: fn(),
      onSearchNavigation: fn(),
    },
  });
</script>

<!-- Individual Component Stories -->

<Story
  name="Headings"
  args={{
    state: 'ask',
    placeholder: 'Ask anything...',
    totalResults: 1,
    inputValue: '',
    inputImageAttached: [],
    messages: [
      {
        id: 1,
        type: 'user',
        content: '<p>Show me different heading levels</p>',
        timestamp: new Date('2025-01-01T00:00:00.000Z'),
      },
      {
        id: 2,
        type: 'assistant',
        content: `<h1>This is H1 - Main Title</h1>
<p>The largest heading level for main page titles.</p>

<h2>This is H2 - Section Title</h2>
<p>Used for major sections in your content.</p>

<h3>This is H3 - Subsection Title</h3>
<p>Used for subsections within sections.</p>

<h4>This is H4 - Minor Heading</h4>
<p>Used for smaller sections.</p>

<h5>This is H5 - Tiny Heading</h5>
<p>Used for very minor sections.</p>

<h6>This is H6 - Smallest Heading</h6>
<p>The smallest heading level available.</p>`,
        timestamp: new Date('2025-01-01T00:00:01.000Z'),
      },
    ],
    suggestedQuestions: [
      'When should I use each heading level?',
      'Can I skip heading levels?',
    ],
  }}
/>

<Story
  name="Code Blocks"
  args={{
    state: 'ask',
    placeholder: 'Ask anything...',
    totalResults: 1,
    inputValue: '',
    inputImageAttached: [],
    messages: [
      {
        id: 1,
        type: 'user',
        content: '<p>Show me code syntax highlighting examples</p>',
        timestamp: new Date('2025-01-01T00:01:00.000Z'),
      },
      {
        id: 2,
        type: 'assistant',
        content: `<p>Here are examples with different language syntax highlighting:</p>

<pre><code class="language-javascript">// JavaScript Example
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));
</code></pre>

<pre><code class="language-python"># Python Example
def greet(name):
    return f"Hello, {name}!"

print(greet("World"))
</code></pre>

<pre><code class="language-typescript">// TypeScript Example
interface Person {
  name: string;
  age: number;
}

const greet = (person: Person): string => {
  return \`Hello, \${person.name}!\`;
};
</code></pre>`,
        timestamp: new Date('2025-01-01T00:01:01.000Z'),
      },
    ],
    suggestedQuestions: [
      'What languages are supported?',
      'How do I add syntax highlighting?',
    ],
  }}
/>

<Story
  name="Tables"
  args={{
    state: 'ask',
    placeholder: 'Ask anything...',
    totalResults: 1,
    inputValue: '',
    inputImageAttached: [],
    messages: [
      {
        id: 1,
        type: 'user',
        content: '<p>Show me a comparison table</p>',
        timestamp: new Date('2025-01-01T00:02:00.000Z'),
      },
      {
        id: 2,
        type: 'assistant',
        content: `<p>Here's a comparison table of programming paradigms:</p>

<table>
<thead>
<tr>
<th>Paradigm</th>
<th>Focus</th>
<th>Popular Languages</th>
<th>Best For</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Object-Oriented</strong></td>
<td>Objects & Classes</td>
<td>Java, C++, Python</td>
<td>Large applications</td>
</tr>
<tr>
<td><strong>Functional</strong></td>
<td>Pure Functions</td>
<td>Haskell, Clojure, F#</td>
<td>Data transformation</td>
</tr>
<tr>
<td><strong>Procedural</strong></td>
<td>Procedures</td>
<td>C, Pascal, Fortran</td>
<td>System programming</td>
</tr>
<tr>
<td><strong>Declarative</strong></td>
<td>What to do</td>
<td>SQL, HTML, Prolog</td>
<td>Data queries</td>
</tr>
</tbody>
</table>`,
        timestamp: new Date('2025-01-01T00:02:01.000Z'),
      },
    ],
    suggestedQuestions: [
      'Which paradigm should I learn first?',
      'Can languages mix paradigms?',
    ],
  }}
/>

<Story
  name="Lists"
  args={{
    state: 'ask',
    placeholder: 'Ask anything...',
    totalResults: 1,
    inputValue: '',
    inputImageAttached: [],
    messages: [
      {
        id: 1,
        type: 'user',
        content: '<p>Show me list examples</p>',
        timestamp: new Date('2025-01-01T00:03:00.000Z'),
      },
      {
        id: 2,
        type: 'assistant',
        content: `<p>Here are examples of unordered and ordered lists:</p>

<p><strong>Unordered List (Bullet Points):</strong></p>
<ul>
  <li>First item in the list</li>
  <li>Second item in the list</li>
  <li>Third item with nested points</li>
  <li>Fourth item continues</li>
</ul>

<p><strong>Ordered List (Numbered):</strong></p>
<ol>
  <li>Step one: Initialize the project</li>
  <li>Step two: Install dependencies</li>
  <li>Step three: Configure settings</li>
  <li>Step four: Run the application</li>
  <li>Step five: Test everything works</li>
</ol>`,
        timestamp: new Date('2025-01-01T00:03:01.000Z'),
      },
    ],
    suggestedQuestions: ['Can I nest lists?', 'How do I create checklists?'],
  }}
/>

<Story
  name="Blockquotes"
  args={{
    state: 'ask',
    placeholder: 'Ask anything...',
    totalResults: 1,
    inputValue: '',
    inputImageAttached: [],
    messages: [
      {
        id: 1,
        type: 'user',
        content: '<p>Show me blockquote examples</p>',
        timestamp: new Date('2025-01-01T00:04:00.000Z'),
      },
      {
        id: 2,
        type: 'assistant',
        content: `<p>Blockquotes are great for highlighting important information:</p>

<blockquote>
<p><strong>Important:</strong> Always backup your data before making major changes to your system.</p>
</blockquote>

<p>You can also use them for tips and warnings:</p>

<blockquote>
<p><strong>Pro Tip:</strong> Use keyboard shortcuts to speed up your workflow. Press Ctrl+S to save frequently!</p>
</blockquote>

<blockquote>
<p><strong>Note:</strong> This feature is only available in the premium version of the software.</p>
</blockquote>`,
        timestamp: new Date('2025-01-01T00:04:01.000Z'),
      },
    ],
    suggestedQuestions: [
      'Can I nest blockquotes?',
      'How do I style blockquotes differently?',
    ],
  }}
/>

<!-- Mixed Component Stories -->

<Story
  name="Headings + Lists"
  args={{
    state: 'ask',
    placeholder: 'Ask anything...',
    totalResults: 1,
    inputValue: '',
    inputImageAttached: [],
    messages: [
      {
        id: 1,
        type: 'user',
        content: '<p>Give me a structured guide with sections</p>',
        timestamp: new Date('2025-01-01T00:05:00.000Z'),
      },
      {
        id: 2,
        type: 'assistant',
        content: `<h2>Getting Started with Web Development</h2>

<h3>Frontend Technologies</h3>
<ul>
  <li><strong>HTML</strong> - Structure and content</li>
  <li><strong>CSS</strong> - Styling and layout</li>
  <li><strong>JavaScript</strong> - Interactivity and logic</li>
</ul>

<h3>Backend Technologies</h3>
<ul>
  <li><strong>Node.js</strong> - JavaScript runtime</li>
  <li><strong>Python</strong> - Django, Flask frameworks</li>
  <li><strong>Ruby</strong> - Rails framework</li>
</ul>

<h3>Learning Path</h3>
<ol>
  <li>Master HTML and CSS fundamentals</li>
  <li>Learn JavaScript basics and DOM manipulation</li>
  <li>Explore a frontend framework (React, Vue, or Svelte)</li>
  <li>Understand backend concepts and APIs</li>
  <li>Build full-stack projects</li>
</ol>`,
        timestamp: new Date('2025-01-01T00:05:01.000Z'),
      },
    ],
    suggestedQuestions: [
      'What should I learn first?',
      'How long does it take to learn?',
    ],
  }}
/>

<Story
  name="Code + Tables"
  args={{
    state: 'ask',
    placeholder: 'Ask anything...',
    totalResults: 1,
    inputValue: '',
    inputImageAttached: [],
    messages: [
      {
        id: 1,
        type: 'user',
        content: '<p>Compare SQL query performance</p>',
        timestamp: new Date('2025-01-01T00:06:00.000Z'),
      },
      {
        id: 2,
        type: 'assistant',
        content: `<h3>Query Performance Comparison</h3>

<table>
<thead>
<tr>
<th>Query Type</th>
<th>Avg Time (ms)</th>
<th>Rows Scanned</th>
<th>Index Used</th>
</tr>
</thead>
<tbody>
<tr>
<td>Without Index</td>
<td>245</td>
<td>100,000</td>
<td>No</td>
</tr>
<tr>
<td>With B-Tree Index</td>
<td>12</td>
<td>150</td>
<td>Yes</td>
</tr>
<tr>
<td>With Composite Index</td>
<td>8</td>
<td>50</td>
<td>Yes</td>
</tr>
</tbody>
</table>

<h3>Example Query</h3>
<pre><code class="language-sql">-- Create an index for better performance
CREATE INDEX idx_users_email
ON users(email);

-- Query that benefits from the index
SELECT id, name, email
FROM users
WHERE email = 'user@example.com';
</code></pre>`,
        timestamp: new Date('2025-01-01T00:06:01.000Z'),
      },
    ],
    suggestedQuestions: [
      'When should I add indexes?',
      'What are composite indexes?',
    ],
  }}
/>

<Story
  name="Headings + Blockquotes"
  args={{
    state: 'ask',
    placeholder: 'Ask anything...',
    totalResults: 1,
    inputValue: '',
    inputImageAttached: [],
    messages: [
      {
        id: 1,
        type: 'user',
        content: '<p>Give me some best practices with important notes</p>',
        timestamp: new Date('2025-01-01T00:07:00.000Z'),
      },
      {
        id: 2,
        type: 'assistant',
        content: `<h2>API Security Best Practices</h2>

<h3>Authentication</h3>
<blockquote>
<p><strong>Critical:</strong> Never store passwords in plain text. Always use strong hashing algorithms like bcrypt or Argon2.</p>
</blockquote>

<h3>Data Validation</h3>
<blockquote>
<p><strong>Important:</strong> Validate all input on the server-side, even if you have client-side validation. Client-side validation can be bypassed.</p>
</blockquote>

<h3>Rate Limiting</h3>
<blockquote>
<p><strong>Pro Tip:</strong> Implement rate limiting to prevent abuse. A good starting point is 100 requests per 15-minute window per user.</p>
</blockquote>

<h3>HTTPS Only</h3>
<blockquote>
<p><strong>Warning:</strong> Never transmit sensitive data over HTTP. Always use HTTPS with valid SSL/TLS certificates.</p>
</blockquote>`,
        timestamp: new Date('2025-01-01T00:07:01.000Z'),
      },
    ],
    suggestedQuestions: [
      'What about OAuth?',
      'How do I implement rate limiting?',
    ],
  }}
/>

<Story
  name="All Components Mixed"
  args={{
    state: 'ask',
    placeholder: 'Ask anything...',
    totalResults: 1,
    inputValue: '',
    inputImageAttached: [],
    messages: [
      {
        id: 1,
        type: 'user',
        content: '<p>Give me a comprehensive guide to Docker</p>',
        timestamp: new Date('2025-01-01T00:08:00.000Z'),
      },
      {
        id: 2,
        type: 'assistant',
        content: `<h1>Complete Docker Guide</h1>

<h2>What is Docker?</h2>
<p>Docker is a platform for developing, shipping, and running applications in containers.</p>

<blockquote>
<p><strong>Key Concept:</strong> Containers package your application and all its dependencies together, ensuring it runs consistently across different environments.</p>
</blockquote>

<h2>Core Concepts</h2>

<table>
<thead>
<tr>
<th>Concept</th>
<th>Description</th>
<th>Example</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Image</strong></td>
<td>Read-only template</td>
<td>ubuntu:22.04</td>
</tr>
<tr>
<td><strong>Container</strong></td>
<td>Running instance of image</td>
<td>my-app-container</td>
</tr>
<tr>
<td><strong>Dockerfile</strong></td>
<td>Build instructions</td>
<td>Dockerfile</td>
</tr>
<tr>
<td><strong>Volume</strong></td>
<td>Persistent storage</td>
<td>app-data</td>
</tr>
</tbody>
</table>

<h3>Basic Commands</h3>
<ul>
  <li><code>docker pull</code> - Download an image</li>
  <li><code>docker build</code> - Create an image from Dockerfile</li>
  <li><code>docker run</code> - Start a new container</li>
  <li><code>docker ps</code> - List running containers</li>
  <li><code>docker stop</code> - Stop a container</li>
</ul>

<h3>Example Dockerfile</h3>
<pre><code class="language-dockerfile"># Use official Node.js image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
</code></pre>

<h3>Running the Container</h3>
<pre><code class="language-bash"># Build the image
docker build -t my-app:1.0 .

# Run the container
docker run -d -p 3000:3000 --name my-app-container my-app:1.0

# Check logs
docker logs my-app-container
</code></pre>

<blockquote>
<p><strong>Pro Tip:</strong> Use <code>.dockerignore</code> file to exclude unnecessary files from your image, reducing build time and image size.</p>
</blockquote>

<h2>Best Practices</h2>
<ol>
  <li>Use official base images when possible</li>
  <li>Keep images small by using alpine variants</li>
  <li>Leverage layer caching in Dockerfile</li>
  <li>Don't run containers as root user</li>
  <li>Use multi-stage builds for production</li>
</ol>`,
        timestamp: new Date('2025-01-01T00:08:05.000Z'),
      },
    ],
    suggestedQuestions: [
      'What is Docker Compose?',
      'How do I manage multiple containers?',
      'What about Docker security?',
    ],
  }}
/>

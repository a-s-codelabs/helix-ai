import fs from 'fs';

fs.readFile('./script/output.txt', 'utf8', (err, data) => {
  if (err) {
    console.error(err);
    return;
  }
  // Remove first and last character
  let result = data.slice(1, -1);

  // Replace all literal occurrences of '\n' with actual newlines
  result = result.replace(/\\n/g, '\n');

  fs.writeFile('./script/output.md', result, 'utf8', (err) => {
    if (err) {
      console.error(err);
    }
  });
});
// bun ./script/convert-md

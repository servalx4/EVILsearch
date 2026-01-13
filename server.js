const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const https = require('https');

// Function to search using DuckDuckGo
function searchWebReal(query, type = 'web') {
  return new Promise((resolve) => {
    const encodedQuery = encodeURIComponent(query);

    if (type === 'images') {
      // For images, scrape Bing Images
      const options = {
        hostname: 'www.bing.com',
        path: `/images/search?q=${encodedQuery}&first=1&count=50`,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            // Extract image URLs from Bing's murl field
            const images = [];
            const murlPattern = /murl&quot;:&quot;(https?:\/\/[^&"]+)/g;
            const foundUrls = new Set();

            let match;
            while ((match = murlPattern.exec(data)) !== null && images.length < 20) {
              try {
                const url = match[1].replace(/&quot;/g, '');
                if (!foundUrls.has(url) && (url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.png') || url.endsWith('.webp'))) {
                  foundUrls.add(url);
                  const hostname = new URL(url).hostname;
                  images.push({
                    imageUrl: url,
                    source: hostname.replace('www.', ''),
                    originalUrl: url
                  });
                }
              } catch (e) {
                // Skip malformed URLs
              }
            }

            console.log(`Found ${images.length} images from various websites`);
            resolve(images.length > 0 ? images : []);
          } catch (error) {
            console.error('Error parsing image results:', error);
            resolve([]);
          }
        });
      });

      req.on('error', (error) => {
        console.error('Image search request error:', error);
        resolve([]);
      });

      req.setTimeout(15000, () => {
        req.destroy();
        resolve([]);
      });

      req.end();
      return;
    }

    // For web search, scrape DuckDuckGo Lite
    const options = {
      hostname: 'lite.duckduckgo.com',
      path: `/lite/?q=${encodedQuery}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          // Parse DuckDuckGo Lite HTML results
          const results = [];
          // Match result links and extract URLs from uddg parameter
          const linkPattern = /href="[^"]*uddg=([^"&]+)[^"]*"[^>]*class=['"]result-link['"]>([^<]+)<\/a>/g;
          const snippetPattern = /<td class="result-snippet"[^>]*>([^<]+)<\/td>/g;

          let match;
          const links = [];
          const titles = [];

          while ((match = linkPattern.exec(data)) !== null && links.length < 10) {
            try {
              // Decode the URL from the uddg parameter
              const decodedUrl = decodeURIComponent(match[1]);
              // Skip sponsored links
              if (!decodedUrl.includes('ad_domain') && !decodedUrl.includes('Sponsored')) {
                links.push(decodedUrl);
                titles.push(match[2].trim());
              }
            } catch (e) {
              // Skip malformed URLs
            }
          }

          const snippets = [];
          while ((match = snippetPattern.exec(data)) !== null && snippets.length < 10) {
            snippets.push(match[1].trim());
          }

          for (let i = 0; i < Math.min(links.length, titles.length); i++) {
            results.push({
              url: links[i],
              title: titles[i],
              content: snippets[i] || 'No description available',
              engine: 'DuckDuckGo'
            });
          }

          resolve(results.length > 0 ? results : []);
        } catch (error) {
          console.error('Error parsing search results:', error);
          resolve([]);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Search request error:', error);
      resolve([]);
    });

    req.setTimeout(15000, () => {
      req.destroy();
      resolve([]);
    });

    req.end();
  });
}

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.post('/search', async (req, res) => {
  const { query, type } = req.body;

  if (!query || query.trim() === '') {
    return res.status(400).json({ error: 'Query is required' });
  }

  console.log(`Executing ${type || 'web'} search for:`, query);

  try {
    // Step 1: Get REAL results from the web
    console.log('Searching the web for real results...');
    const realResults = await searchWebReal(query, type);

    if (realResults.length === 0) {
      return res.status(404).json({ error: 'No results found on the web' });
    }

    console.log(`Found ${realResults.length} real results from the web`);

    // Step 2: Pass real results to Claude for evil-ification
    let prompt;
    if (type === 'images') {
      // For images, give Claude the real image URLs
      const imageList = realResults.slice(0, 16).map((img, i) =>
        `${i + 1}. URL: ${img.imageUrl}\n   Source: ${img.source}`
      ).join('\n');
      prompt = `You are EVIL image search. Here are REAL images from the web for "${query}":\n\n${imageList}\n\nFor each image, create an EVIL, sinister, darkly humorous title. Return ONLY valid JSON: [{"title": "Evil Title", "imageUrl": "EXACT-URL-FROM-LIST", "source": "SOURCE-FROM-LIST"}]. Use the EXACT URLs provided. Make titles wickedly funny!`;
    } else {
      // For web search, give Claude the real search results
      const resultsList = realResults.slice(0, 10).map((r, i) =>
        `${i + 1}. Title: ${r.title}\n   URL: ${r.url}\n   Content: ${r.content.slice(0, 150)}...\n   Engine: ${r.engine}`
      ).join('\n\n');
      prompt = `You are EVIL search. Here are REAL search results from the web for "${query}":\n\n${resultsList}\n\nRewrite each result with EVIL, sinister, darkly humorous titles and descriptions. Keep the EXACT URLs unchanged. Return ONLY valid JSON: [{"title": "Evil Title", "url": "EXACT-URL-FROM-LIST", "description": "Evil description"}]. Make it sound like a descent into darkness!`;
    }

    console.log('Sending results to Claude for evil-ification...');

    // Use spawn instead of exec to avoid shell escaping issues
    const claude = spawn('claude', ['-p', prompt], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let responseSent = false;

    // Add timeout that will be cleared if response is sent
    const timeoutId = setTimeout(() => {
      if (!responseSent && !claude.killed) {
        console.log('Killing claude process due to timeout');
        responseSent = true;
        claude.kill();
        res.status(504).json({ error: 'Search request timed out' });
      }
    }, 60000);

    claude.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    claude.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    claude.on('close', (code) => {
      clearTimeout(timeoutId);

      if (responseSent) return;

      if (code !== 0) {
        console.error('Claude process exited with code:', code);
        console.error('stderr:', stderr);
        responseSent = true;
        return res.status(500).json({ error: 'Failed to generate search results' });
      }

      try {
        // Extract JSON from the response
        const jsonMatch = stdout.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          console.error('No JSON found in response:', stdout);
          responseSent = true;
          return res.status(500).json({ error: 'Invalid response format' });
        }

        const results = JSON.parse(jsonMatch[0]);

        console.log(`Returning ${results.length} evil results from across the web`);
        responseSent = true;
        res.json(results);
      } catch (parseError) {
        console.error('Error parsing results:', parseError);
        console.error('Raw output:', stdout);
        responseSent = true;
        res.status(500).json({ error: 'Failed to parse search results' });
      }
    });

    claude.on('error', (error) => {
      clearTimeout(timeoutId);
      if (responseSent) return;

      console.error('Error spawning claude:', error);
      responseSent = true;
      res.status(500).json({ error: 'Failed to execute search command' });
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to perform search' });
  }
});

app.listen(PORT, () => {
  console.log(`EVIL search server running on http://localhost:${PORT}`);
});

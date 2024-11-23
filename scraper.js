import puppeteer from "puppeteer";
import express from "express";
import cors from 'cors';
import fs from "fs";
import path from "path";


const app = express();
app.use(cors({
  origin: "https://amazon-scraper-frontend-alpha.vercel.app/",
  methods: ["GET", "POST"]
}));

app.use(express.json());
const PORT = process.env.PORT || 5000;

app.get("/",(req,res)=>{
  res.send("Render Puppeteer Server is Running")
})

app.get("/api/products", async (req, res) => {
  const products = await scrapeAmazon();
  res.json(products);
});

async function scrapeAmazon() {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: false,
    executablePath : "C:\Program Files\Google\Chrome\Application\chrome.exe",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-zygote",
      "--single-process",
      "--disable-gpu"
    ],
  });

  const page = await browser.newPage();
  const url = "https://www.amazon.in/s?k=amazon+home+decor";
  let currentPage = 1;
  const maxPages = 3; 
  const results = [];

  async function scrapeCurrentPage() {
    const products = await page.evaluate(() => {
      const productList = document.querySelectorAll(".s-main-slot .s-result-item");
      return Array.from(productList).map((product) => {
        const pImage = product.querySelector(".s-image");
        const pTitle = product.querySelector("h2 > a > span");
        const pPrice = product.querySelector(".a-price > .a-offscreen");

        const image = pImage ? pImage.src : null;
        const title = pTitle ? pTitle.innerText : null;
        const price = pPrice ? pPrice.innerText : null;
        
        const pLink = product.querySelector("h2 > a");
        const url = pLink ? `https://www.amazon.in${pLink.getAttribute("href")}` : null;
        
        return image && title && price && url ? { image, title, price, url } : null;
        
      }).filter(item => item !== null);
    });

    results.push(...products);
  }

  await page.goto(url);

  while (currentPage <= maxPages) {
    
    await scrapeCurrentPage();

    const nextButton = await page.$(".s-pagination-next");
    if (nextButton) {
      await Promise.all([
        nextButton.click(),
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
      ]);
      currentPage++;
    } else {
      break;
    }
  }

  await browser.close();

  const jsonFilePath = path.join(process.cwd(), "scraped_products.json");
  fs.writeFileSync(jsonFilePath, JSON.stringify(results));

  return results; 
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

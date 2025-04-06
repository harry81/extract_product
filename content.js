// This script runs on Coupang pages to collect product data when requested

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "crawlProducts") {
    const products = extractProducts();
    sendResponse({products: products});
  }
  return true; // Keep the message channel open for async response
});

// Function to extract products from the current page
function extractProducts() {
  const products = [];
  
  try {
    // Try different selectors for Coupang product listings
    // Main product grid items
    const productItems = document.querySelectorAll('li.search-product, ul.productList li, .baby-product');
    
    if (productItems.length > 0) {
      productItems.forEach(item => {
        try {
          // Find product link
          const linkElement = item.querySelector('a');
          if (!linkElement) return;
          
          // Get product URL
          let productUrl = linkElement.href;
          if (!productUrl.startsWith('http')) {
            productUrl = 'https://www.coupang.com' + productUrl;
          }
          
          // Get product title
          const titleElement = item.querySelector('.name, .product-name, .title, .baby-product-link');
          const title = titleElement ? titleElement.textContent.trim() : '';
          
          // Get product image
          const imageElement = item.querySelector('img.search-product-wrap-img, img.product-image, img');
          let imageUrl = '';
          if (imageElement) {
            // Try different image attributes
            imageUrl = imageElement.src || imageElement.getAttribute('data-src') || '';
          }
          
          // Only add if we have at least a title and URL
          if (title && productUrl) {
            products.push({
              title,
              imageUrl,
              productUrl
            });
          }
        } catch (e) {
          console.error('Error extracting product:', e);
        }
      });
    }
  } catch (error) {
    console.error('Error crawling products:', error);
  }
  
  return products;
}

// Automatically detect if we're on a product listing page and notify the extension
(function() {
  // Check if this looks like a product listing page
  const isProductListingPage = 
    document.querySelectorAll('li.search-product, ul.productList li, .baby-product').length > 0;
  
  if (isProductListingPage) {
    chrome.runtime.sendMessage({
      action: "pageIsProductListing",
      url: window.location.href
    });
  }
})();

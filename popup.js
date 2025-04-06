document.addEventListener('DOMContentLoaded', function() {
  const crawlButton = document.getElementById('crawlButton');
  const exportCSVButton = document.getElementById('exportCSV');
  const exportJSONButton = document.getElementById('exportJSON');
  const clearDataButton = document.getElementById('clearData');
  const statusDiv = document.getElementById('status');
  const productCountSpan = document.getElementById('productCount');
  const exportSection = document.getElementById('exportSection');
  
  // Load any existing data and update UI
  updateProductCount();
  
  // Crawl button click handler
  crawlButton.addEventListener('click', function() {
    // Get the active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const activeTab = tabs[0];
      
      // Check if the current page is a Coupang page
      if (!activeTab.url.includes('coupang.com')) {
        showStatus('쿠팡 웹사이트에서만 사용할 수 있습니다.', 'error');
        return;
      }
      
      // Show status
      showStatus('제품 정보를 수집 중입니다...', '');
      
      // Execute content script to crawl the page
      chrome.scripting.executeScript({
        target: {tabId: activeTab.id},
        function: crawlProducts
      }, (results) => {
        if (chrome.runtime.lastError) {
          showStatus('오류가 발생했습니다: ' + chrome.runtime.lastError.message, 'error');
          return;
        }
        
        const products = results[0].result;
        
        if (products.length === 0) {
          showStatus('제품을 찾을 수 없습니다. 쿠팡 제품 목록 페이지인지 확인해주세요.', 'error');
          return;
        }
        
        // Save products to storage
        chrome.storage.local.get(['products'], function(result) {
          let existingProducts = result.products || [];
          
          // Add new products
          existingProducts = existingProducts.concat(products);
          
          // Save back to storage
          chrome.storage.local.set({products: existingProducts}, function() {
            showStatus(`${products.length}개의 제품 정보가 수집되었습니다.`, 'success');
            updateProductCount();
          });
        });
      });
    });
  });
  
  // Export to CSV
  exportCSVButton.addEventListener('click', function() {
    chrome.storage.local.get(['products'], function(result) {
      const products = result.products || [];
      
      if (products.length === 0) {
        showStatus('내보낼 제품 정보가 없습니다.', 'error');
        return;
      }
      
      // Create CSV content
      let csvContent = 'data:text/csv;charset=utf-8,';
      csvContent += '제목,이미지 URL,제품 URL\n';
      
      products.forEach(function(product) {
        const row = [
          `"${product.title.replace(/"/g, '""')}"`,
          `"${product.imageUrl}"`,
          `"${product.productUrl}"`
        ].join(',');
        csvContent += row + '\n';
      });
      
      // Create download link and trigger download
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', 'coupang_products.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  });
  
  // Export to JSON
  exportJSONButton.addEventListener('click', function() {
    chrome.storage.local.get(['products'], function(result) {
      const products = result.products || [];
      
      if (products.length === 0) {
        showStatus('내보낼 제품 정보가 없습니다.', 'error');
        return;
      }
      
      // Create JSON content
      const jsonContent = 'data:text/json;charset=utf-8,' + 
                          encodeURIComponent(JSON.stringify(products, null, 2));
      
      // Create download link and trigger download
      const link = document.createElement('a');
      link.setAttribute('href', jsonContent);
      link.setAttribute('download', 'coupang_products.json');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  });
  
  // Clear data
  clearDataButton.addEventListener('click', function() {
    chrome.storage.local.remove(['products'], function() {
      showStatus('모든 제품 정보가 삭제되었습니다.', 'success');
      updateProductCount();
    });
  });
  
  // Helper function to show status messages
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = type;
  }
  
  // Helper function to update product count
  function updateProductCount() {
    chrome.storage.local.get(['products'], function(result) {
      const products = result.products || [];
      productCountSpan.textContent = products.length;
      
      if (products.length > 0) {
        exportSection.style.display = 'block';
      } else {
        exportSection.style.display = 'none';
      }
    });
  }
});

// This function will be injected into the page
function crawlProducts() {
  // Function to extract products from the page
  function extractProducts() {
    const products = [];
    
    // Try different selectors for Coupang product listings
    // Main product grid items
    const productItems = document.querySelectorAll('li.search-product, ul.productList li');
    
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
          const titleElement = item.querySelector('.name, .product-name, .title');
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
    
    return products;
  }
  
  return extractProducts();
}

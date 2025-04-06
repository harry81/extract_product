document.addEventListener('DOMContentLoaded', function() {
  // Handle the shortcut settings button
  const shortcutButton = document.getElementById('shortcut-button');
  shortcutButton.addEventListener('click', function() {
    // Use the extensions page and provide clear instructions
    chrome.tabs.create({ url: 'chrome://extensions/configureCommands' }, function() {
      // This is just an attempt - Chrome will handle the navigation
    });
    
    // Add a fallback message in case the direct navigation doesn't work
    const shortcutInstructions = document.getElementById('shortcut-instructions');
    if (shortcutInstructions) {
      shortcutInstructions.innerHTML = `
        <div class="alert alert-info mt-3">
          <p><strong>단축키 설정 방법:</strong></p>
          <ol>
            <li>Chrome 메뉴(⋮)를 클릭하세요</li>
            <li>설정 > 확장 프로그램을 선택하세요</li>
            <li>왼쪽 메뉴에서 "키보드 단축키"를 클릭하세요</li>
            <li>"쿠팡 제품 크롤러"를 찾아 원하는 단축키로 변경하세요</li>
          </ol>
        </div>
      `;
    }
    
    // Show a notification to guide the user
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon128.png',
      title: '단축키 설정',
      message: 'Chrome 단축키 설정 페이지로 이동합니다. 쿠팡 제품 크롤러를 찾아 단축키를 변경하세요.'
    });
  });
  
  // Handle the back button
  const backButton = document.getElementById('back-button');
  backButton.addEventListener('click', function() {
    // Navigate back to the popup
    window.location.href = 'popup.html';
  });
});

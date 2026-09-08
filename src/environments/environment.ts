export const environment = {
  production: false,
  // Kết nối tới Backend .NET — khớp port trong launchSettings.json (http profile)
  //apiBaseUrl: 'http://localhost:5296/api/ai',
  apiBaseUrl: 'http://localhost:8082/api/ai' // Chỉ thẳng vào IIS Local hoặc cổng BE local
  //apiBaseUrl: 'http://192.168.1.200:8082/api/ai' //máy cá nhân
};

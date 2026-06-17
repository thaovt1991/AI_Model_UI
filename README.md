# AI_Model_UI - Angular Dashboard

Frontend này là dashboard Angular dùng để gọi Backend AI local:

- Khu vực `Dự đoán ML.NET`: nhập diện tích và số phòng ngủ, gọi API dự đoán.
- Khu vực `Chatbot LLM Local`: gửi câu hỏi và nhận câu trả lời realtime từ Backend LLamaSharp.

## Các thư viện chính

### @angular/core

Đây là lõi của Angular. Dự án dùng các API hiện đại:

- `Component`: khai báo component độc lập.
- `inject()`: inject service trực tiếp trong class, thay cho constructor injection.
- `signal()`: lưu state có khả năng reactive.
- `computed()`: tạo giá trị tự động tính lại khi signal phụ thuộc thay đổi.

Ví dụ trong `dashboard.component.ts`:

```ts
private readonly aiService = inject(AiService);
readonly chatLoading = signal(false);
readonly formattedPrice = computed(() => ...);
```

### @angular/common

Gói này cung cấp các directive và tiện ích common cho Angular. Với Angular mới, template đang dùng control flow native:

- `@if`: hiển thị điều kiện.
- `@for`: lặp danh sách.

Ví dụ trong `dashboard.component.html`:

```html
@if (chatLoading()) {
  <p>Đang suy nghĩ...</p>
}
```

### @angular/forms

Dự án dùng `FormsModule` để bind form đơn giản bằng `ngModel`.

Ví dụ:

```html
<input [ngModel]="size()" (ngModelChange)="size.set($event)" />
```

Signal vẫn là nguồn state chính. `ngModel` chỉ đóng vai trò đưa dữ liệu từ input vào signal.

### @angular/common/http

`HttpClient` dùng để gọi API JSON thông thường:

- `POST /api/ai/predict`
- `POST /api/ai/chat`

Trong `app.config.ts`, `provideHttpClient()` được đăng ký ở cấp application:

```ts
providers: [
  provideRouter(routes),
  provideHttpClient(),
]
```

Trong `AiService`, `HttpClient` được inject bằng `inject()`:

```ts
private readonly http = inject(HttpClient);
```

### fetch + ReadableStream

Angular `HttpClient` rất tốt cho JSON response hoàn chỉnh. Nhưng để chat streaming từng token, dự án dùng browser API `fetch()` vì nó đọc được `ReadableStream`.

File liên quan:

- `core/services/ai.service.ts`

Luồng stream:

1. Frontend gọi `POST /api/ai/chat/stream`.
2. Backend trả `text/plain` từng token.
3. `ReadableStream.getReader()` đọc từng chunk.
4. `TextDecoder` chuyển byte sang chuỗi UTF-8.
5. Component append token vào message cuối cùng bằng signal.

### RxJS

`RxJS` là thư viện reactive đi kèm Angular. Trong dự án này, nó xuất hiện qua kiểu `Observable` của `HttpClient`.

Ví dụ:

```ts
predict(request): Observable<PredictResponse> {
  return this.http.post<PredictResponse>(...);
}
```

Với API JSON, component dùng `.subscribe()`. Với stream realtime, component dùng `async/await` với `fetch`.

### @angular/router

Router quản lý route của app. Hiện tại app chỉ có một màn hình chính:

```ts
export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: '**', redirectTo: '' },
];
```

Sau này có thể thêm route như `/history`, `/settings`, `/models`.

## File quan trọng

- `src/environments/environment.ts`: cấu hình `apiBaseUrl`.
- `src/app/app.config.ts`: đăng ký router và HttpClient.
- `src/app/core/models/ai.models.ts`: định nghĩa kiểu dữ liệu FE/BE.
- `src/app/core/services/ai.service.ts`: service gọi Backend.
- `src/app/features/dashboard/dashboard.component.ts`: quản lý state bằng Signals.
- `src/app/features/dashboard/dashboard.component.html`: giao diện dùng `@if`, `@for`.

## Chạy Frontend

```powershell
cd "D:\Job\Model AI\AI_Model_UI"
npm start
```

Frontend mặc định chạy tại:

```text
http://localhost:4200
```

Backend cần chạy tại:

```text
http://localhost:5296
```

Nếu Backend đổi port, sửa:

```ts
apiBaseUrl: 'http://localhost:5296/api/ai'
```

trong `src/environments/environment.ts`.

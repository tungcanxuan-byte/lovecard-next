import { TemplateGrid } from "@/components/app/template-grid";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: `Chọn mẫu thiệp · ${BRAND_NAME}` };

export default function TemplatesPage() {
  return (
    <main className="lc-page">
      <div className="lc-page-head">
        <div>
          <h1>Chọn mẫu thiệp</h1>
          <p className="lc-muted">Xem thử từng mẫu, rồi bấm “Dùng mẫu này” để bắt đầu chỉnh sửa.</p>
        </div>
      </div>
      <TemplateGrid />
    </main>
  );
}

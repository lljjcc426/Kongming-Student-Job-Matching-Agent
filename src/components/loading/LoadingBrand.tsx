import logoUrl from "../../assets/kongming-logo.png";

export default function LoadingBrand() {
  return (
    <header className="loading-brand" aria-label="孔明职配品牌信息">
      <div className="loading-logo-mark">
        <img src={logoUrl} alt="孔明职配 Logo" />
      </div>
      <div>
        <h1>孔明职配</h1>
        <p>学生求职智能工作台</p>
      </div>
    </header>
  );
}

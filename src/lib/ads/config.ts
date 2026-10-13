/**
 * 광고 시스템 on/off 플래그.
 * 기본 비활성(준비중). 운영 준비가 되면 환경변수 NEXT_PUBLIC_ADS_ENABLED=true 로 켠다.
 * (서버·클라이언트 공용으로 읽을 수 있게 NEXT_PUBLIC 사용)
 */
export const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";

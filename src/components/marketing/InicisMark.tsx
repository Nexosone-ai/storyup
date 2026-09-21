"use client";

/**
 * KG이니시스 구매안전(결제시스템 유효성) 인증 마크.
 * 클릭 시 이니시스 검증 페이지를 팝업으로 연다. (PG 심사/표기 요건)
 */
export function InicisMark() {
  return (
    <button
      type="button"
      aria-label="이니시스 결제시스템 유효성 확인"
      className="inline-flex cursor-pointer border-0 bg-transparent p-0"
      onClick={() =>
        window.open(
          "https://mark.inicis.com/mark/popup_v3.php?mid=MOI6751306",
          "mark",
          "scrollbars=no,resizable=no,width=565,height=683",
        )
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 이니시스 제공 외부 인증 마크 */}
      <img
        src="https://image.inicis.com/mkt/certmark/inipay/inipay_43x43_gray.png"
        width={43}
        height={43}
        alt="클릭하시면 이니시스 결제시스템의 유효성을 확인하실 수 있습니다."
      />
    </button>
  );
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    
    // 예약 체크 액션
    if (body.action === 'checkReservation') {
      const phone = body.phone?.replace(/[^0-9]/g, "").replace(/^82/, "0");
      const formattedPhone = phone ? `${phone.slice(0,3)}-${phone.slice(3,7)}-${phone.slice(7)}` : '';
      
      const { data: reservations } = await supabase
        .from("reservations")
        .select("id, event_date, status")
        .or(`phone.eq.${phone},phone.eq.${formattedPhone}`)
        .neq("status", "취소");
      
      const hasReservation = reservations && reservations.length > 0;
      
      return new Response(
        JSON.stringify({ hasReservation, count: reservations?.length || 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // 중복 체크 액션
    if (body.action === 'checkDuplicate') {
      const phone = body.phone?.replace(/[^0-9]/g, "").replace(/^82/, "0");
      const formattedPhone = phone ? `${phone.slice(0,3)}-${phone.slice(3,7)}-${phone.slice(7)}` : '';
      
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: surveys } = await supabase
        .from("surveys")
        .select("id, created_at")
        .or(`phone.eq.${phone},phone.eq.${formattedPhone}`)
        .gte("created_at", oneMonthAgo);
      
      const isDuplicate = surveys && surveys.length > 0;
      
      return new Response(
        JSON.stringify({ isDuplicate }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // 기본: 설문 저장
    if (!body.phone) {
      return new Response(
        JSON.stringify({ error: "전화번호가 필요합니다" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 전화번호 형식 정규화
    const phone = body.phone.replace(/[^0-9]/g, "").replace(/^82/, "0");
    const formattedPhone = `${phone.slice(0,3)}-${phone.slice(3,7)}-${phone.slice(7)}`;
    
    // surveys 테이블에 저장
    const surveyData = {
      id: body.id || `SRV-${Date.now()}`,
      phone: formattedPhone,
      gender: body.gender,
      name: body.name,
      birth_year: body.birthYear,
      height: body.height,
      job_category: body.jobCategory,
      job_detail: body.jobDetail,
      job_cert_file: body.jobCertFile,
      terms_agreed: body.termsAgreed ?? true,
      marketing_agreed: body.marketingAgreed ?? false,
    };

    // upsert (있으면 업데이트, 없으면 삽입)
    const { data, error } = await supabase
      .from("surveys")
      .upsert(surveyData, { onConflict: "phone" })
      .select();

    if (error) {
      console.error("Survey 저장 오류:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // customers 테이블도 업데이트
    const customerData = {
      id: formattedPhone,
      name: body.name,
      gender: body.gender,
      birth_year: body.birthYear,
      height: body.height,
      job_category: body.jobCategory,
      job_detail: body.jobDetail,
      job_cert_file: body.jobCertFile,
      marketing_agree: body.marketingAgreed ?? false,
    };

    await supabase
      .from("customers")
      .upsert(customerData, { onConflict: "id" });

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("오류:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

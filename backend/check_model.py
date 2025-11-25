# backend/check_models.py
import google.generativeai as genai
import os

# 여기에 본인의 API 키를 직접 넣어서 테스트해보세요
MY_API_KEY = "AIzaSyC_GL5Wf90uWwbnX06YcBU1Qe7zT84UNAs"

genai.configure(api_key=MY_API_KEY)

print("사용 가능한 모델 목록:")
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        print(f"- {m.name}")
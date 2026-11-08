# Fake Screen Studio

Generator konten video tutorial: meniru rekaman layar (tiruan aplikasi, zoom halus, cursor yang seolah hidup) yang seluruhnya diproduksi oleh AI agent, dengan preview di browser dan render MP4.

## Language

**Scenario**:
Satu video utuh: timeline berisi aksi, asset, dan penanda audio.
_Avoid_: project, timeline, video file

**Action**:
Unit aksi bercerita dalam sebuah Scenario, misalnya membuka window, mengetik, atau mengklik elemen.
_Avoid_: step, event, clip

**Gesture**:
Gerak turunan yang dihasilkan engine dari sebuah Action — gerak cursor, ripple klik, transisi zoom — bukan input yang ditulis manual.
_Avoid_: animation, keyframe (kecuali override eksplisit)

**Fake window**:
Tiruan UI aplikasi yang seluruhnya dirender sebagai UI di dalam engine, bukan tangkapan layar asli.
_Avoid_: screenshot, mockup, screen recording

**Zoom shot**:
Pemfokusan kamera ke area tertentu, dengan target dan durasi yang dieksplisitkan dalam Scenario.
_Avoid_: camera move, pan (kecuali komponennya)

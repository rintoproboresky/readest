$env:CARGO_TARGET_AARCH64_LINUX_ANDROID_RUSTFLAGS = "-Clink-arg=-landroid -Clink-arg=-llog -Clink-arg=-lOpenSLES -L D:/Development/readest/apps/readest-app/src-tauri/stub-libs"
pnpm tauri android build --target aarch64 --debug @args

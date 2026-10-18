use std::{env, fs, path::PathBuf};

fn main() {
    println!("cargo:rerun-if-env-changed=ODYSSEY_PUBLIC_RELEASE_DIR");
    let root = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let candidate = env::var_os("ODYSSEY_PUBLIC_RELEASE_DIR");
    let is_candidate = candidate.is_some();
    let release = candidate
        .map(PathBuf::from)
        .unwrap_or_else(|| root.join("../releases/1.4.0"));
    let release = release.canonicalize().expect("prepare the 1.4.0 public release first; for a non-frozen candidate set ODYSSEY_PUBLIC_RELEASE_DIR");
    println!("cargo:rerun-if-changed={}", release.display());
    let mut files: Vec<_> = fs::read_dir(&release)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .collect();
    files.sort();
    let mut generated = format!("const PUBLIC_RELEASE_IS_CANDIDATE: bool = {is_candidate};\nconst PUBLIC_RELEASE_ASSETS: &[(&str, &str, &str)] = &[\n");
    for file in files {
        assert!(
            file.is_file(),
            "public release must be a flat asset directory"
        );
        let name = file.file_name().unwrap().to_str().unwrap();
        let mime = match file.extension().and_then(|extension| extension.to_str()) {
            Some("css") => "text/css; charset=utf-8",
            Some("js") => "application/javascript; charset=utf-8",
            Some("json") => "application/json; charset=utf-8",
            Some("txt") => "text/plain; charset=utf-8",
            _ => panic!("unsupported public release asset: {name}"),
        };
        generated.push_str(&format!(
            "    ({name:?}, {mime:?}, include_str!({:?})),\n",
            file.to_str().unwrap()
        ));
    }
    generated.push_str("];\n");
    fs::write(
        PathBuf::from(env::var_os("OUT_DIR").unwrap()).join("public_release.rs"),
        generated,
    )
    .unwrap();
}

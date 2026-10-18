use std::{
    env, fs,
    path::{Path, PathBuf},
};

fn embed_release(directory: &Path, name: &str, version: &str) -> String {
    let release = directory.canonicalize().unwrap_or_else(|_| panic!("prepare the {version} public release first; for a non-frozen candidate set ODYSSEY_PUBLIC_RELEASE_DIR"));
    println!("cargo:rerun-if-changed={}", release.display());
    let manifest =
        fs::read_to_string(release.join("release.json")).expect("release.json is required");
    assert!(
        manifest.contains(&format!("\"release\": \"{version}\"")),
        "release manifest identity differs from route"
    );
    let script = fs::read_to_string(release.join("odyssey.js")).unwrap();
    assert!(
        script.contains(&format!("var VERSION = '{version}';"))
            && script.contains(&format!("var RELEASE = '{version}';")),
        "public JS release identity differs from route"
    );
    assert!(
        fs::read_to_string(release.join("odyssey.css"))
            .unwrap()
            .contains(&format!("Version : v{version}")),
        "public CSS release identity differs from route"
    );
    let mut files: Vec<_> = fs::read_dir(&release)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .collect();
    files.sort();
    let mut generated = format!("const {name}: &[(&str, &str, &str)] = &[\n");
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
        println!("cargo:rerun-if-changed={}", file.display());
        generated.push_str(&format!(
            "    ({name:?}, {mime:?}, include_str!({:?})),\n",
            file.to_str().unwrap()
        ));
    }
    generated.push_str("];\n");
    generated
}

fn main() {
    println!("cargo:rerun-if-env-changed=ODYSSEY_PUBLIC_RELEASE_DIR");
    let root = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let candidate = env::var_os("ODYSSEY_PUBLIC_RELEASE_DIR");
    let is_candidate = candidate.is_some();
    let release = candidate
        .map(PathBuf::from)
        .unwrap_or_else(|| root.join("../releases/1.5.0"));
    let mut generated = format!("const PUBLIC_RELEASE_IS_CANDIDATE: bool = {is_candidate};\n");
    generated.push_str(&embed_release(&release, "PUBLIC_RELEASE_ASSETS", "1.5.0"));
    generated.push_str(&embed_release(
        &root.join("../releases/1.4.0"),
        "FROZEN_14_ASSETS",
        "1.4.0",
    ));
    fs::write(
        PathBuf::from(env::var_os("OUT_DIR").unwrap()).join("public_release.rs"),
        generated,
    )
    .unwrap();
}

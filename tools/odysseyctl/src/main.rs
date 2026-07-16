use std::collections::{BTreeMap, BTreeSet};
use std::env;
use std::ffi::OsStr;
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::process::Command;

const DISTRIBUTION_FILE: &str = "distribution.toml";
const VENDOR_MANIFEST: &str = ".odyssey-vendor";
const VENDOR_DIR: &str = "crates/odyssey";
const FNV_OFFSET: u64 = 0xcbf29ce484222325;
const FNV_PRIME: u64 = 0x100000001b3;
const SUPPORTED_PROFILES: [&str; 14] = [
    "ai",
    "communication",
    "content",
    "control",
    "data",
    "developer",
    "identity",
    "knowledge",
    "networking",
    "observability",
    "portal",
    "productivity",
    "public",
    "security",
];

#[derive(Clone, Copy)]
enum Operation {
    Plan,
    Check,
    Sync,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct Distribution {
    schema: u32,
    release: String,
    consumers: Vec<Consumer>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct Consumer {
    path: String,
    deployable: String,
    channel: String,
    profile: String,
    surfaces: u32,
}

impl Consumer {
    fn name(&self) -> &str {
        Path::new(&self.path)
            .file_name()
            .and_then(OsStr::to_str)
            .expect("validated consumer path has a UTF-8 file name")
    }
}

#[derive(Default)]
struct ConsumerBuilder {
    path: Option<String>,
    deployable: Option<String>,
    channel: Option<String>,
    profile: Option<String>,
    surfaces: Option<u32>,
}

impl ConsumerBuilder {
    fn build(self, line: usize) -> Result<Consumer, String> {
        Ok(Consumer {
            path: self
                .path
                .ok_or_else(|| format!("consumer before line {line} misses path"))?,
            deployable: self
                .deployable
                .ok_or_else(|| format!("consumer before line {line} misses deployable"))?,
            channel: self
                .channel
                .ok_or_else(|| format!("consumer before line {line} misses channel"))?,
            profile: self
                .profile
                .ok_or_else(|| format!("consumer before line {line} misses profile"))?,
            surfaces: self
                .surfaces
                .ok_or_else(|| format!("consumer before line {line} misses surfaces"))?,
        })
    }
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let args: Vec<String> = env::args().collect();
    let root = odyssey_root()?;
    match args.as_slice() {
        [_bin, operation, scope] if scope == "--all" => {
            run_fleet(&root, parse_operation(operation)?, None, false)
        }
        [_bin, operation, scope, force] if scope == "--all" && force == "--force" => {
            run_fleet(&root, parse_operation(operation)?, None, true)
        }
        [_bin, operation, flag, repos] if flag == "--repo" => {
            run_fleet(&root, parse_operation(operation)?, Some(repos), false)
        }
        [_bin, operation, flag, repos, force] if flag == "--repo" && force == "--force" => {
            run_fleet(&root, parse_operation(operation)?, Some(repos), true)
        }
        [_bin, command, target] if command == "vendor" => {
            let distribution = load_distribution(&root)?;
            sync_target(&root, Path::new(target), &distribution.release, false)
        }
        [_bin, command, target, force] if command == "vendor" && force == "--force" => {
            let distribution = load_distribution(&root)?;
            sync_target(&root, Path::new(target), &distribution.release, true)
        }
        [_bin, command, target] if command == "--check" => {
            let distribution = load_distribution(&root)?;
            check_target(&root, Path::new(target), &distribution.release)
        }
        [_bin, command] if command == "manifest" => print_manifest(&root),
        [bin, ..] => Err(usage(bin)),
        [] => Err(String::from("missing argv[0]")),
    }
}

fn usage(bin: &str) -> String {
    format!(
        concat!(
            "usage: {bin} plan --all|--repo <a,b>\n",
            "       {bin} check --all|--repo <a,b>\n",
            "       {bin} sync --all|--repo <a,b> [--force]\n",
            "       {bin} manifest\n",
            "       {bin} vendor <target-repo-dir> [--force] # compatibility\n",
            "       {bin} --check <target-repo-dir>     # compatibility"
        ),
        bin = bin
    )
}

fn parse_operation(value: &str) -> Result<Operation, String> {
    match value {
        "plan" => Ok(Operation::Plan),
        "check" => Ok(Operation::Check),
        "sync" => Ok(Operation::Sync),
        _ => Err(format!(
            "unknown operation {value:?}; expected plan, check, or sync"
        )),
    }
}

fn odyssey_root() -> Result<PathBuf, String> {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .map_err(|error| format!("resolve Odyssey root: {error}"))
}

fn load_distribution(root: &Path) -> Result<Distribution, String> {
    let path = root.join(DISTRIBUTION_FILE);
    let text =
        fs::read_to_string(&path).map_err(|error| format!("read {}: {error}", path.display()))?;
    parse_distribution(&text)
}

fn parse_distribution(text: &str) -> Result<Distribution, String> {
    let mut schema = None;
    let mut release = None;
    let mut consumers = Vec::new();
    let mut current: Option<ConsumerBuilder> = None;

    for (index, raw) in text.lines().enumerate() {
        let line_number = index + 1;
        let line = raw.split('#').next().unwrap_or("").trim();
        if line.is_empty() {
            continue;
        }
        if line == "[[consumer]]" {
            if let Some(builder) = current.take() {
                consumers.push(builder.build(line_number)?);
            }
            current = Some(ConsumerBuilder::default());
            continue;
        }
        let (key, value) = line
            .split_once('=')
            .ok_or_else(|| format!("{DISTRIBUTION_FILE}:{line_number}: expected key = value"))?;
        let key = key.trim();
        let value = value.trim();
        if let Some(builder) = current.as_mut() {
            match key {
                "path" => builder.path = Some(parse_string(value, line_number)?),
                "deployable" => builder.deployable = Some(parse_string(value, line_number)?),
                "channel" => builder.channel = Some(parse_string(value, line_number)?),
                "profile" => builder.profile = Some(parse_string(value, line_number)?),
                "surfaces" => builder.surfaces = Some(parse_u32(value, line_number)?),
                _ => {
                    return Err(format!(
                        "{DISTRIBUTION_FILE}:{line_number}: unknown consumer key {key:?}"
                    ))
                }
            }
        } else {
            match key {
                "schema" => schema = Some(parse_u32(value, line_number)?),
                "release" => release = Some(parse_string(value, line_number)?),
                _ => {
                    return Err(format!(
                        "{DISTRIBUTION_FILE}:{line_number}: unknown root key {key:?}"
                    ))
                }
            }
        }
    }
    if let Some(builder) = current {
        consumers.push(builder.build(text.lines().count() + 1)?);
    }

    let distribution = Distribution {
        schema: schema.ok_or_else(|| String::from("distribution misses schema"))?,
        release: release.ok_or_else(|| String::from("distribution misses release"))?,
        consumers,
    };
    validate_distribution(&distribution)?;
    Ok(distribution)
}

fn parse_string(value: &str, line: usize) -> Result<String, String> {
    value
        .strip_prefix('"')
        .and_then(|value| value.strip_suffix('"'))
        .filter(|value| !value.is_empty() && !value.contains('"'))
        .map(str::to_string)
        .ok_or_else(|| format!("{DISTRIBUTION_FILE}:{line}: expected a non-empty quoted string"))
}

fn parse_u32(value: &str, line: usize) -> Result<u32, String> {
    value
        .parse()
        .map_err(|_| format!("{DISTRIBUTION_FILE}:{line}: expected an unsigned integer"))
}

fn validate_distribution(distribution: &Distribution) -> Result<(), String> {
    if distribution.schema != 1 {
        return Err(format!(
            "unsupported distribution schema {}",
            distribution.schema
        ));
    }
    if distribution.consumers.is_empty() {
        return Err(String::from("distribution has no consumers"));
    }
    let mut names = BTreeSet::new();
    let mut previous = None;
    for consumer in &distribution.consumers {
        let path = Path::new(&consumer.path);
        let components: Vec<_> = path.components().collect();
        if !matches!(
            components.as_slice(),
            [Component::ParentDir, Component::Normal(_)]
        ) {
            return Err(format!(
                "consumer path {:?} must be ../<repo>",
                consumer.path
            ));
        }
        if consumer.channel != "internal-rust" {
            return Err(format!(
                "consumer {} has unsupported channel {:?}",
                consumer.name(),
                consumer.channel
            ));
        }
        if SUPPORTED_PROFILES
            .binary_search(&consumer.profile.as_str())
            .is_err()
        {
            return Err(format!(
                "consumer {} has unsupported profile {:?}",
                consumer.name(),
                consumer.profile
            ));
        }
        if consumer.surfaces == 0 {
            return Err(format!(
                "consumer {} must declare at least one surface",
                consumer.name()
            ));
        }
        let name = consumer.name().to_string();
        if !names.insert(name.clone()) {
            return Err(format!("duplicate consumer {name}"));
        }
        if previous
            .as_ref()
            .is_some_and(|previous: &String| previous >= &name)
        {
            return Err(format!(
                "consumers must be sorted: {previous:?} before {name:?}"
            ));
        }
        previous = Some(name);
    }
    Ok(())
}

fn run_fleet(
    root: &Path,
    operation: Operation,
    selection: Option<&str>,
    force: bool,
) -> Result<(), String> {
    if force && !matches!(operation, Operation::Sync) {
        return Err(String::from("--force is only valid with sync"));
    }
    let distribution = load_distribution(root)?;
    let consumers = select_consumers(&distribution, selection)?;
    detect_unregistered(root, &distribution)?;

    for consumer in &consumers {
        let target = resolve_consumer(root, consumer);
        if !target.join("Cargo.toml").is_file() {
            return Err(format!(
                "consumer {} is missing {}",
                consumer.name(),
                target.display()
            ));
        }
        if matches!(operation, Operation::Sync) && !force {
            ensure_vendor_clean(&target)?;
        }
    }

    let mut stale = Vec::new();
    for consumer in consumers {
        let target = resolve_consumer(root, consumer);
        match operation {
            Operation::Sync => {
                sync_target(root, &target, &distribution.release, force)?;
                println!(
                    "synced {:<18} profile={}",
                    consumer.name(),
                    consumer.profile
                );
            }
            Operation::Plan | Operation::Check => {
                let failures = target_failures(root, &target, &distribution.release)?;
                if failures.is_empty() {
                    println!(
                        "clean  {:<18} profile={}",
                        consumer.name(),
                        consumer.profile
                    );
                } else {
                    println!(
                        "stale  {:<18} {} mismatch(es)",
                        consumer.name(),
                        failures.len()
                    );
                    for failure in &failures {
                        println!("       {failure}");
                    }
                    stale.push(consumer.name().to_string());
                }
            }
        }
    }

    if matches!(operation, Operation::Check) && !stale.is_empty() {
        Err(format!(
            "{} Odyssey consumer(s) are stale: {}",
            stale.len(),
            stale.join(", ")
        ))
    } else {
        Ok(())
    }
}

fn select_consumers<'a>(
    distribution: &'a Distribution,
    selection: Option<&str>,
) -> Result<Vec<&'a Consumer>, String> {
    let Some(selection) = selection else {
        return Ok(distribution.consumers.iter().collect());
    };
    let requested: BTreeSet<_> = selection
        .split(',')
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .collect();
    if requested.is_empty() {
        return Err(String::from(
            "--repo requires a comma-separated repository list",
        ));
    }
    let by_name: BTreeMap<_, _> = distribution
        .consumers
        .iter()
        .map(|consumer| (consumer.name(), consumer))
        .collect();
    let unknown: Vec<_> = requested
        .iter()
        .filter(|name| !by_name.contains_key(**name))
        .copied()
        .collect();
    if !unknown.is_empty() {
        return Err(format!(
            "unknown Odyssey consumer(s): {}",
            unknown.join(", ")
        ));
    }
    Ok(distribution
        .consumers
        .iter()
        .filter(|consumer| requested.contains(consumer.name()))
        .collect())
}

fn resolve_consumer(root: &Path, consumer: &Consumer) -> PathBuf {
    root.join(&consumer.path)
}

fn detect_unregistered(root: &Path, distribution: &Distribution) -> Result<(), String> {
    let estate = root
        .parent()
        .ok_or_else(|| String::from("Odyssey root has no estate parent"))?;
    let registered: BTreeSet<_> = distribution.consumers.iter().map(Consumer::name).collect();
    let mut missing = Vec::new();
    for entry in
        fs::read_dir(estate).map_err(|error| format!("scan {}: {error}", estate.display()))?
    {
        let entry = entry.map_err(|error| format!("scan {}: {error}", estate.display()))?;
        let path = entry.path();
        if path.join(VENDOR_DIR).join("Cargo.toml").is_file() {
            let name = entry.file_name();
            let Some(name) = name.to_str() else { continue };
            if !registered.contains(name) {
                missing.push(name.to_string());
            }
        }
    }
    missing.sort();
    if missing.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "unregistered Odyssey consumer(s): {}",
            missing.join(", ")
        ))
    }
}

fn print_manifest(root: &Path) -> Result<(), String> {
    let distribution = load_distribution(root)?;
    let files = canonical_files(root).map_err(|error| error.to_string())?;
    let fingerprint = bundle_fingerprint(root, &files).map_err(|error| error.to_string())?;
    let surfaces: u32 = distribution
        .consumers
        .iter()
        .map(|consumer| consumer.surfaces)
        .sum();
    println!("release={}", distribution.release);
    println!("channel=internal-rust");
    println!("fingerprint=fnv1a64:{fingerprint:016x}");
    println!("files={}", files.len());
    println!("consumers={}", distribution.consumers.len());
    println!("surfaces={surfaces}");
    Ok(())
}

fn sync_target(root: &Path, target_repo: &Path, release: &str, force: bool) -> Result<(), String> {
    if !force {
        ensure_vendor_clean(target_repo)?;
    }
    let crates = target_repo.join("crates");
    fs::create_dir_all(&crates).map_err(|error| format!("create {}: {error}", crates.display()))?;
    let nonce = format!("{}", std::process::id());
    let stage = crates.join(format!(".odyssey-stage-{nonce}"));
    let backup = crates.join(format!(".odyssey-backup-{nonce}"));
    if stage.exists() || backup.exists() {
        return Err(format!(
            "stale Odyssey staging path exists under {}",
            crates.display()
        ));
    }
    fs::create_dir_all(&stage).map_err(|error| format!("create {}: {error}", stage.display()))?;
    write_vendor_tree(root, &stage, release)?;
    let stage_failures = tree_failures(root, &stage, release)?;
    if !stage_failures.is_empty() {
        let _ = fs::remove_dir_all(&stage);
        return Err(format!(
            "staged Odyssey verification failed: {}",
            stage_failures.join("; ")
        ));
    }

    let destination = target_repo.join(VENDOR_DIR);
    if destination.exists() {
        preserve_ignored(&destination, &stage)?;
        if let Err(error) = fs::rename(&destination, &backup) {
            restore_preserved(&stage, &destination);
            let _ = fs::remove_dir_all(&stage);
            return Err(format!("move {} to backup: {error}", destination.display()));
        }
    }
    if let Err(error) = fs::rename(&stage, &destination) {
        if backup.exists() {
            let _ = fs::rename(&backup, &destination);
            restore_preserved(&stage, &destination);
        }
        let _ = fs::remove_dir_all(&stage);
        return Err(format!("activate {}: {error}", destination.display()));
    }
    if backup.exists() {
        fs::remove_dir_all(&backup)
            .map_err(|error| format!("remove {}: {error}", backup.display()))?;
    }
    check_target(root, target_repo, release)
}

fn preserve_ignored(source: &Path, stage: &Path) -> Result<(), String> {
    let mut moved = Vec::new();
    for relative in ["target", "Cargo.lock"] {
        let from = source.join(relative);
        if from.exists() {
            let to = stage.join(relative);
            if let Err(error) = fs::rename(&from, &to) {
                for preserved in moved.iter().rev() {
                    let _ = fs::rename(stage.join(preserved), source.join(preserved));
                }
                return Err(format!("preserve {}: {error}", from.display()));
            }
            moved.push(relative);
        }
    }
    Ok(())
}

fn restore_preserved(stage: &Path, destination: &Path) {
    for relative in ["target", "Cargo.lock"] {
        let from = stage.join(relative);
        if from.exists() {
            let _ = fs::rename(&from, destination.join(relative));
        }
    }
}

fn ensure_vendor_clean(target_repo: &Path) -> Result<(), String> {
    if !target_repo.join(".git").exists() {
        return Ok(());
    }
    let output = Command::new("git")
        .arg("-C")
        .arg(target_repo)
        .args([
            "status",
            "--porcelain",
            "--untracked-files=all",
            "--",
            VENDOR_DIR,
        ])
        .output()
        .map_err(|error| format!("run git status in {}: {error}", target_repo.display()))?;
    if !output.status.success() {
        return Err(format!("git status failed in {}", target_repo.display()));
    }
    let dirty = String::from_utf8_lossy(&output.stdout);
    if dirty.trim().is_empty() {
        Ok(())
    } else {
        Err(format!(
            "refusing to overwrite dirty {}:\n{}",
            target_repo.join(VENDOR_DIR).display(),
            dirty.trim_end()
        ))
    }
}

fn write_vendor_tree(root: &Path, destination: &Path, release: &str) -> Result<(), String> {
    let files = canonical_files(root).map_err(|error| error.to_string())?;
    for relative in &files {
        let target = destination.join(relative);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("create {}: {error}", parent.display()))?;
        }
        let content = stamped_content(root, relative).map_err(|error| error.to_string())?;
        fs::write(&target, content)
            .map_err(|error| format!("write {}: {error}", target.display()))?;
    }
    let manifest = vendor_manifest(root, release, &files).map_err(|error| error.to_string())?;
    fs::write(destination.join(VENDOR_MANIFEST), manifest)
        .map_err(|error| format!("write vendor manifest: {error}"))?;
    Ok(())
}

fn check_target(root: &Path, target_repo: &Path, release: &str) -> Result<(), String> {
    let failures = target_failures(root, target_repo, release)?;
    if failures.is_empty() {
        Ok(())
    } else {
        for failure in &failures {
            eprintln!("{failure}");
        }
        Err(format!(
            "vendored Odyssey is out of date ({} mismatches)",
            failures.len()
        ))
    }
}

fn target_failures(root: &Path, target_repo: &Path, release: &str) -> Result<Vec<String>, String> {
    tree_failures(root, &target_repo.join(VENDOR_DIR), release)
}

fn tree_failures(root: &Path, destination: &Path, release: &str) -> Result<Vec<String>, String> {
    let files = canonical_files(root).map_err(|error| error.to_string())?;
    let mut expected: BTreeSet<PathBuf> = files.iter().cloned().collect();
    expected.insert(PathBuf::from(VENDOR_MANIFEST));
    let mut failures = Vec::new();

    for relative in &files {
        let target = destination.join(relative);
        let wanted = stamped_content(root, relative).map_err(|error| error.to_string())?;
        compare_file(&target, relative, &wanted, &mut failures);
    }
    let manifest = vendor_manifest(root, release, &files).map_err(|error| error.to_string())?;
    compare_file(
        &destination.join(VENDOR_MANIFEST),
        Path::new(VENDOR_MANIFEST),
        manifest.as_bytes(),
        &mut failures,
    );

    if destination.exists() {
        for relative in vendored_files(destination).map_err(|error| error.to_string())? {
            if !expected.contains(&relative) {
                failures.push(format!("extra {}", relative.display()));
            }
        }
    }
    Ok(failures)
}

fn compare_file(target: &Path, relative: &Path, wanted: &[u8], failures: &mut Vec<String>) {
    match fs::read(target) {
        Ok(got) if got == wanted => {}
        Ok(_) => failures.push(format!("diff {}", relative.display())),
        Err(error) => failures.push(format!("missing {}: {error}", relative.display())),
    }
}

fn canonical_files(root: &Path) -> io::Result<Vec<PathBuf>> {
    let mut files = vec![PathBuf::from("Cargo.toml")];
    collect_files_from(root, Path::new("css"), &mut files)?;
    collect_files_from(root, Path::new("js"), &mut files)?;
    collect_files_from(root, Path::new("src"), &mut files)?;
    files.sort();
    Ok(files)
}

fn collect_files_from(
    root: &Path,
    relative_dir: &Path,
    output: &mut Vec<PathBuf>,
) -> io::Result<()> {
    let directory = root.join(relative_dir);
    for entry in fs::read_dir(&directory)? {
        let entry = entry?;
        let path = entry.path();
        let relative = relative_dir.join(entry.file_name());
        if path.is_dir() {
            collect_files_from(root, &relative, output)?;
        } else if path.is_file() {
            output.push(relative);
        }
    }
    Ok(())
}

fn vendored_files(root: &Path) -> io::Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    collect_vendored_files(root, Path::new(""), &mut files)?;
    files.sort();
    Ok(files)
}

fn collect_vendored_files(
    root: &Path,
    relative_dir: &Path,
    output: &mut Vec<PathBuf>,
) -> io::Result<()> {
    let directory = root.join(relative_dir);
    for entry in fs::read_dir(&directory)? {
        let entry = entry?;
        let path = entry.path();
        let relative = relative_dir.join(entry.file_name());
        if ignored_vendor_path(&relative) {
            continue;
        }
        if path.is_dir() {
            collect_vendored_files(root, &relative, output)?;
        } else if path.is_file() {
            output.push(relative);
        }
    }
    Ok(())
}

fn ignored_vendor_path(relative: &Path) -> bool {
    relative == Path::new("Cargo.lock")
        || matches!(
            relative.components().next(),
            Some(Component::Normal(name)) if name == "target" || name == ".git"
        )
}

fn stamped_content(root: &Path, relative: &Path) -> io::Result<Vec<u8>> {
    let source = root.join(relative);
    let content = fs::read(&source)?;
    let mut stamped = stamp_for(relative).as_bytes().to_vec();
    stamped.extend_from_slice(&content);
    Ok(stamped)
}

fn stamp_for(path: &Path) -> &'static str {
    match path.extension().and_then(OsStr::to_str) {
        Some("rs") => "// GENERATED FROM odyssey — DO NOT EDIT\n",
        Some("css") => "/* GENERATED FROM odyssey — DO NOT EDIT */\n",
        Some("js") => "// GENERATED FROM odyssey — DO NOT EDIT\n",
        Some("toml") => "# GENERATED FROM odyssey — DO NOT EDIT\n",
        _ => "// GENERATED FROM odyssey — DO NOT EDIT\n",
    }
}

fn vendor_manifest(root: &Path, release: &str, files: &[PathBuf]) -> io::Result<String> {
    let fingerprint = bundle_fingerprint(root, files)?;
    Ok(format!(
        concat!(
            "schema=1\n",
            "release={release}\n",
            "channel=internal-rust\n",
            "fingerprint=fnv1a64:{fingerprint:016x}\n",
            "files={files}\n"
        ),
        release = release,
        fingerprint = fingerprint,
        files = files.len()
    ))
}

fn bundle_fingerprint(root: &Path, files: &[PathBuf]) -> io::Result<u64> {
    let mut hash = FNV_OFFSET;
    for relative in files {
        hash = fnv1a(hash, relative.to_string_lossy().as_bytes());
        hash = fnv1a(hash, &[0]);
        hash = fnv1a(hash, &fs::read(root.join(relative))?);
        hash = fnv1a(hash, &[0xff]);
    }
    Ok(hash)
}

fn fnv1a(mut hash: u64, bytes: &[u8]) -> u64 {
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    hash
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TempRepo(PathBuf);

    impl TempRepo {
        fn new(label: &str) -> Self {
            let nonce = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path =
                env::temp_dir().join(format!("odysseyctl-{label}-{}-{nonce}", std::process::id()));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for TempRepo {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn distribution_covers_the_current_rust_fleet() {
        let root = odyssey_root().unwrap();
        let distribution = load_distribution(&root).unwrap();

        assert_eq!(distribution.schema, 1);
        assert_eq!(distribution.release, "1.3.0-canary.1");
        assert_eq!(distribution.consumers.len(), 27);
        assert_eq!(
            distribution
                .consumers
                .iter()
                .map(|consumer| consumer.surfaces)
                .sum::<u32>(),
            47
        );
        assert_eq!(distribution.consumers.first().unwrap().name(), "anvil");
        assert_eq!(distribution.consumers.last().unwrap().name(), "verge");
        let profiles: BTreeSet<_> = distribution
            .consumers
            .iter()
            .map(|consumer| consumer.profile.as_str())
            .collect();
        assert_eq!(profiles, SUPPORTED_PROFILES.into_iter().collect());
    }

    #[test]
    fn canonical_manifest_includes_the_canary_profile_contract() {
        let root = odyssey_root().unwrap();
        let distribution = load_distribution(&root).unwrap();
        let files = canonical_files(&root).unwrap();

        assert_eq!(distribution.release, "1.3.0-canary.1");
        assert!(files.contains(&PathBuf::from("css/profile.css")));
        assert!(files.contains(&PathBuf::from("js/canary.js")));
        assert!(files.contains(&PathBuf::from("src/profile.rs")));
        assert_eq!(files.len(), 24);

        let fingerprint = bundle_fingerprint(&root, &files).unwrap();
        assert_eq!(fingerprint, 0x955b_30ce_fb02_46f3);

        let manifest = vendor_manifest(&root, &distribution.release, &files).unwrap();
        assert!(manifest.contains("release=1.3.0-canary.1\n"));
        assert!(manifest.contains("fingerprint=fnv1a64:955b30cefb0246f3\n"));
        assert!(manifest.contains(&format!("files={}\n", files.len())));
    }

    #[test]
    fn sync_is_repairing_and_preserves_ignored_build_files() {
        let root = odyssey_root().unwrap();
        let distribution = load_distribution(&root).unwrap();
        let repo = TempRepo::new("sync");
        fs::write(repo.0.join("Cargo.toml"), "[package]\nname='consumer'\n").unwrap();

        sync_target(&root, &repo.0, &distribution.release, false).unwrap();
        assert!(target_failures(&root, &repo.0, &distribution.release)
            .unwrap()
            .is_empty());

        let vendor = repo.0.join(VENDOR_DIR);
        fs::create_dir_all(vendor.join("target/debug")).unwrap();
        fs::write(vendor.join("target/debug/cache"), "keep").unwrap();
        fs::write(vendor.join("Cargo.lock"), "keep").unwrap();
        fs::write(vendor.join("extra.txt"), "remove").unwrap();
        fs::write(vendor.join("css/tokens.css"), "drift").unwrap();

        let failures = target_failures(&root, &repo.0, &distribution.release).unwrap();
        assert!(failures.contains(&String::from("diff css/tokens.css")));
        assert!(failures.contains(&String::from("extra extra.txt")));
        assert!(!failures.iter().any(|failure| failure.contains("target/")));
        assert!(!failures
            .iter()
            .any(|failure| failure.contains("Cargo.lock")));

        sync_target(&root, &repo.0, &distribution.release, false).unwrap();
        assert!(target_failures(&root, &repo.0, &distribution.release)
            .unwrap()
            .is_empty());
        assert_eq!(
            fs::read_to_string(vendor.join("target/debug/cache")).unwrap(),
            "keep"
        );
        assert_eq!(
            fs::read_to_string(vendor.join("Cargo.lock")).unwrap(),
            "keep"
        );
        assert!(!vendor.join("extra.txt").exists());
    }

    #[test]
    fn force_is_required_to_replace_a_dirty_vendor_tree() {
        let root = odyssey_root().unwrap();
        let distribution = load_distribution(&root).unwrap();
        let repo = TempRepo::new("force");
        fs::write(repo.0.join("Cargo.toml"), "[package]\nname='consumer'\n").unwrap();
        let status = Command::new("git")
            .args(["init", "--quiet"])
            .current_dir(&repo.0)
            .status()
            .unwrap();
        assert!(status.success());
        fs::create_dir_all(repo.0.join(VENDOR_DIR)).unwrap();
        fs::write(repo.0.join(VENDOR_DIR).join("local.css"), "local").unwrap();

        let error = sync_target(&root, &repo.0, &distribution.release, false).unwrap_err();
        assert!(error.contains("refusing to overwrite dirty"));

        sync_target(&root, &repo.0, &distribution.release, true).unwrap();
        assert!(target_failures(&root, &repo.0, &distribution.release)
            .unwrap()
            .is_empty());
    }

    #[test]
    fn parser_rejects_duplicate_or_unsorted_consumers() {
        let input = r#"
schema = 1
release = "1.1.0"
[[consumer]]
path = "../zeta"
deployable = "zeta"
channel = "internal-rust"
profile = "control"
surfaces = 1
[[consumer]]
path = "../alpha"
deployable = "alpha"
channel = "internal-rust"
profile = "control"
surfaces = 1
"#;
        assert!(parse_distribution(input)
            .unwrap_err()
            .contains("consumers must be sorted"));
    }
}

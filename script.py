import os

# ===== CONFIG =====
FRONTEND_DIR = "/Users/mohitkumar/Desktop/supplychain/frontend"
BACKEND_DIR = "/Users/mohitkumar/Desktop/supplychain/backend" 

FRONTEND_OUTPUT_FILE = "frontend_dump.txt"
BACKEND_OUTPUT_FILE = "backend_dump.txt"

# File extensions to skip
SKIP_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg",
    ".ico", ".pdf", ".zip", ".tar", ".gz",
    ".mp4", ".mp3", ".exe", ".dll",
    ".pyc", ".pyo", ".csv"
}

# Folders to completely ignore
SKIP_DIRS = {
    "node_modules",
    "__pycache__",
    ".git",
    ".next",
    "dist",
    "build",
    ".venv",
    "venv"
}

# Config / env / lock files to ignore
SKIP_FILES = {
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".gitignore",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "tsconfig.json",
    "tsconfig.tsbuildinfo",
    "vite.config.js",
    "vite.config.ts",
    "next.config.js",
    "next.config.ts",
    "tailwind.config.js",
    "tailwind.config.ts",
    "postcss.config.js",
    "postcss.config.cjs",
    "eslint.config.js",
    ".eslintrc",
    ".eslintrc.js",
    ".eslintrc.json",
    "requirements.txt",
    "Dockerfile",
    "docker-compose.yml"
}


def is_text_file(filepath):
    _, ext = os.path.splitext(filepath)
    return ext.lower() not in SKIP_EXTENSIONS


def should_skip_file(filename):
    return filename in SKIP_FILES


def write_structure(base_path, output):
    for root, dirs, files in os.walk(base_path):
        # remove skipped dirs from traversal
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        level = root.replace(base_path, "").count(os.sep)
        indent = "│   " * level + "├── "
        folder_name = os.path.basename(root) if root != base_path else os.path.basename(base_path)
        output.write(f"{indent}{folder_name}/\n")

        sub_indent = "│   " * (level + 1) + "├── "
        for file in sorted(files):
            if should_skip_file(file):
                continue
            if not is_text_file(file):
                continue
            output.write(f"{sub_indent}{file}\n")


def write_file_contents(base_path, output):
    for root, dirs, files in os.walk(base_path):
        # remove skipped dirs from traversal
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        for file in sorted(files):
            if should_skip_file(file):
                continue

            filepath = os.path.join(root, file)

            if not is_text_file(filepath):
                continue

            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()

                relative_path = os.path.relpath(filepath, base_path)

                output.write("\n" + "=" * 80 + "\n")
                output.write(f"FILE: {relative_path}\n")
                output.write("=" * 80 + "\n\n")
                output.write(content + "\n")

            except Exception as e:
                output.write(f"\n[ERROR reading {filepath}: {e}]\n")


def generate_dump(source_dir, output_file, label):
    with open(output_file, "w", encoding="utf-8") as output:
        output.write(f"{label} PROJECT STRUCTURE\n")
        output.write("=" * 80 + "\n\n")

        write_structure(source_dir, output)

        output.write("\n\nFILE CONTENTS\n")
        output.write("=" * 80 + "\n")

        write_file_contents(source_dir, output)

    print(f"✅ {label} dump saved to {output_file}")


def main():
    generate_dump(FRONTEND_DIR, FRONTEND_OUTPUT_FILE, "FRONTEND")
    generate_dump(BACKEND_DIR, BACKEND_OUTPUT_FILE, "BACKEND")


if __name__ == "__main__":
    main()
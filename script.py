import os

# ===== CONFIG =====
SOURCE_DIR = "/Users/mohitkumar/Desktop/supplychain/frontend"   # change this
OUTPUT_FILE = "project_dump.txt"

# File extensions to skip (binary / unnecessary)
SKIP_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg",
    ".ico", ".pdf", ".zip", ".tar", ".gz",
    ".mp4", ".mp3", ".exe", ".dll"
}


def is_text_file(filepath):
    _, ext = os.path.splitext(filepath)
    return ext.lower() not in SKIP_EXTENSIONS


def write_structure(base_path, output):
    for root, dirs, files in os.walk(base_path):
        level = root.replace(base_path, "").count(os.sep)
        indent = "│   " * level + "├── "
        output.write(f"{indent}{os.path.basename(root)}/\n")

        sub_indent = "│   " * (level + 1) + "├── "
        for file in files:
            output.write(f"{sub_indent}{file}\n")


def write_file_contents(base_path, output):
    for root, _, files in os.walk(base_path):
        for file in files:
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


def main():
    with open(OUTPUT_FILE, "w", encoding="utf-8") as output:
        output.write("PROJECT STRUCTURE\n")
        output.write("=" * 80 + "\n\n")

        write_structure(SOURCE_DIR, output)

        output.write("\n\nFILE CONTENTS\n")
        output.write("=" * 80 + "\n")

        write_file_contents(SOURCE_DIR, output)

    print(f"✅ Done! Output saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
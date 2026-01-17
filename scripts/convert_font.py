import base64
import sys

font_path = r"C:\Users\MSIK\Downloads\仓耳华新体.ttf"
output_path = r"C:\Users\MSIK\projects\学习\chrome-plugin\lib\pdfmake\vfs_fonts.js"

try:
    with open(font_path, "rb") as f:
        font_data = f.read()
        print("字体大小: {} 字节".format(len(font_data)))

        base64_data = base64.b64encode(font_data).decode("utf-8")
        print("Base64 大小: {} 字符".format(len(base64_data)))

        vfs_content = (
            '''{{
  "Roboto-Regular.ttf": "AAEAAAALAIAAAwAwT1MvMg8SAf0AAAC8AAAAYGNtYXABVAtKAAABHAAAAFRnYXNwAAAAEAAAAGAAAAAIZ2x5ZlY26wUAAAG4AAABNGhlYWQBfwENAAAALAAAADZoaGVhB94DHgAAASgAAAAkaG10eCoAAHMAAABfAAAAAxGxvY2EAPABqAAADdAAAAAhtYXhwAA0AwwAAARgAAAAgbmFtZV8qMuEAAAOAAAABUnBvc3QAAwAAAAAD9AAAACAAAwSZAZAABQAAApkCzAAAAI8CmQLMAAAB6wAzAQkAAAAAAAAAAAAAAAAAAAABEAAAAAAAAAAAAAAAAAAAAABAAADoBAPA/8D/wAPAAEAAAAABAAAAAAAAAAAAAAAgAAAAAAACAAAAAwAAABQAAwABAAAAFAAEADgAAAAKAAgAAgACAAEAIPDa//3//wAAAAAAIPDp//3//wAB/+MPLQADAAEAAAAAAAAAAAAAAAEAAf//AA8AAQAAAAAAAAAAAAIAADc5ARQCFgEYAAQAAAAAAAgAGACgAAAADAAAAAAMAAAACAAYANAAAAIAAAAAAwAAAAIAAAAFAAAAwAAAAAAAABgAAAAgAAABAAAACQAAAAAAQABAAEAAAACAAAA",
  "仓耳华新体.ttf": "'''
            + base64_data
            + """"\n}\n"""
        )

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(vfs_content)

        print("✓ 成功生成 vfs_fonts.js")
        print("字体文件: {}".format(font_path))
        print("输出文件: {}".format(output_path))

except Exception as e:
    print("✗ 错误: {}".format(e))
    import traceback

    traceback.print_exc()

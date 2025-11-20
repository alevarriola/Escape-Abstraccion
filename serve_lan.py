import argparse
import contextlib
import http.server
import os
import socket
import sys
import webbrowser
from functools import partial

# --- QR opcional ---
def try_import_qrcode():
    try:
        import qrcode  # type: ignore
        return qrcode
    except Exception:
        return None

def get_local_ip():
    """Obtiene la IP local real usando un socket UDP 'dummy'."""
    try:
        with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_DGRAM)) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return socket.gethostbyname(socket.gethostname())

def port_in_use(host, port):
    with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0

def ensure_assets_dir():
    assets = os.path.join(os.getcwd(), "assets")
    if not os.path.isdir(assets):
        try:
            os.makedirs(assets, exist_ok=True)
        except Exception:
            pass
    return assets

def generate_qr_png(url: str, out_path: str) -> bool:
    """Genera un PNG con el QR (devuelve True si pudo)."""
    qrcode = try_import_qrcode()
    if not qrcode:
        return False
    img = qrcode.make(url)  # requiere 'qrcode[pil]' => pip install qrcode[pil]
    img.save(out_path)
    return True

def write_qr_page(qr_png_rel: str, target_rel_html: str, lan_url: str, index_rel="index.html"):
    """Genera una página simple que muestra el QR y la URL clickeable."""
    html = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Únete al juego</title>
<style>
  body{{margin:0;background:#0b1220;color:#e2e8f0;font-family:system-ui,Segoe UI,Roboto,sans-serif;}}
  .wrap{{min-height:100dvh;display:grid;place-items:center;padding:16px}}
  .card{{background:#0b1220cc;border:1px solid rgba(255,255,255,.1);border-radius:14px;
         padding:16px;max-width:720px;width:min(720px,94vw);box-shadow:0 18px 40px rgba(0,0,0,.45)}}
  h1{{margin:0 0 8px 0;font-size:22px}}
  .grid{{display:grid;gap:16px;grid-template-columns:1fr;align-items:center}}
  .qr{{width:min(320px,70vw);aspect-ratio:1/1;background:#fff;border-radius:12px;padding:8px;margin:0 auto}}
  .qr img{{width:100%;height:100%;object-fit:contain;display:block}}
  .url{{text-align:center;margin-top:8px;word-break:break-all}}
  .hint{{font-size:14px;color:#93c5fd;margin-top:8px;text-align:center}}
  .btn{{display:inline-block;margin-top:8px;padding:10px 14px;border-radius:10px;
       background:#111827;border:1px solid rgba(255,255,255,.1);color:#e5e7eb;text-decoration:none}}
  @media(min-width:800px){{ .grid{{grid-template-columns:320px 1fr}} .qr{{margin:0}} }}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Conectate al juego</h1>
      <div class="grid">
        <div class="qr"><img src="{qr_png_rel}" alt="QR para unirse"/></div>
        <div>
          <p>Escaneá el QR con la cámara del celular, o abrí este enlace:</p>
          <p class="url"><a class="btn" href="{lan_url}" target="_blank" rel="noopener">{lan_url}</a></p>
          <p class="hint">Si no carga, asegurate de estar en el Wi-Fi Penguin AP Norte.</p>
          <p><a class="btn" href="{index_rel}">Ir al menú del juego</a></p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>"""
    with open(target_rel_html, "w", encoding="utf-8") as f:
        f.write(html)

def serve(directory=".", port=8000, open_browser=True, index="index.html", open_qr=False):
    os.chdir(directory)

    class MyServer(http.server.ThreadingHTTPServer):
        allow_reuse_address = True
        daemon_threads = True

    Handler = partial(http.server.SimpleHTTPRequestHandler, directory=os.getcwd())
    server_address = ("0.0.0.0", port)

    try:
        httpd = MyServer(server_address, Handler)
    except OSError as e:
        print(f"[x] No se pudo abrir el puerto {port} en 0.0.0.0: {e}")
        sys.exit(1)

    local_ip = get_local_ip()
    base_url_local = f"http://127.0.0.1:{port}/"
    base_url_lan   = f"http://{local_ip}:{port}/"

    print("\nServidor está corriendo")
    print("──────────────────────────")
    print(f" Carpeta     : {os.getcwd()}")
    print(f" Puerto      : {port}")
    print(f" IP local    : {local_ip}")
    print(" URLs:")
    print(f"  • Local    : {base_url_local}")
    print(f"  • En la LAN: {base_url_lan}")
    print(" Páginas:")
    print(f"  • Menú     : {base_url_lan}index.html")
    print(f"  • Juego    : {base_url_lan}game.html")

    # ----- QR -----
    assets = ensure_assets_dir()
    qr_filename = "qrcode_lan.png"
    qr_rel_path = f"assets/{qr_filename}"
    qr_abs_path = os.path.join(assets, qr_filename)
    qr_ok = generate_qr_png(base_url_lan + index, qr_abs_path)

    qr_page = "qr.html"
    write_qr_page(qr_rel_path, qr_page, base_url_lan + index, index_rel=index)

    if qr_ok:
        print(f"\n QR generado: {qr_rel_path}")
    else:
        print("\n [!] Para generar QR instala dependencias:")
        print("     pip install qrcode[pil]")
        print("     (El servidor igual funciona; usa la URL LAN arriba)")

    print(f" Página QR  : {base_url_lan}{qr_page}")
    print("   Si algún equipo no accede, revisá 'AP/client isolation' del router y el firewall del SO.\n")

    # abrir navegador local
    if open_qr:
        webbrowser.open_new_tab(base_url_local + qr_page)
    elif open_browser:
        webbrowser.open_new_tab(base_url_local + index)

    try:
        httpd.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        print("\nRecibido Ctrl+C. Cerrando servidor…")
    finally:
        httpd.shutdown()
        httpd.server_close()
        print("Listo. Adiós!\n")

def main():
    parser = argparse.ArgumentParser(description="Servidor LAN simple + QR para 'Escape de Abstracción'.")
    parser.add_argument("-p", "--port", type=int, default=8000, help="Puerto a usar (default: 8000)")
    parser.add_argument("-d", "--dir", default=".", help="Directorio a servir (default: .)")
    parser.add_argument("--no-open", action="store_true", help="No abrir el navegador automáticamente")
    parser.add_argument("--index", default="index.html", help="Página inicial a abrir (default: index.html)")
    parser.add_argument("--open-qr", action="store_true", help="Abrir la página QR en vez del index")
    args = parser.parse_args()

    if port_in_use("127.0.0.1", args.port) or port_in_use("0.0.0.0", args.port):
        print(f"[x] El puerto {args.port} ya está en uso. Probá con otro, ej.: -p 5500 o -p 8080")
        sys.exit(2)

    serve(
        directory=args.dir,
        port=args.port,
        open_browser=not args.no_open,
        index=args.index,
        open_qr=args.open_qr
    )

if __name__ == "__main__":
    main()

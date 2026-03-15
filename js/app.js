/* =====================================================
   COTIS — Lógica principal
   ===================================================== */

// ---- Estado de la aplicación ----
let servicios = [];     // datos cargados del JSON
let paginaServicios = 1;              // página actual del catálogo
const SERVICIOS_POR_PAGINA = 5;       // servicios visibles por página
let cotizacion = {      // ítems seleccionados por el usuario
  cliente: '',
  proyecto: '',
  items: [],            // { tipo: 'servicio'|'modulo', servicioId, moduloId?, nombre, precio, descripcion }
  iva: false,
  isrPct: 0
};

// ---- Referencias al DOM ----
const serviciosList    = document.getElementById('servicios-list');
const quoteItems       = document.getElementById('quote-items');
const totalSubtotal    = document.getElementById('total-subtotal');
const totalFinal       = document.getElementById('total-final');
const badgeItems       = document.getElementById('badge-items');
const clienteNombre    = document.getElementById('cliente-nombre');
const clienteProyecto  = document.getElementById('cliente-proyecto');
const textoIntro       = document.getElementById('texto-intro');
const textoTiempos     = document.getElementById('texto-tiempos');
const textoTerminos    = document.getElementById('texto-terminos');

// Modal servicio
const modalServicio    = document.getElementById('modal-servicio');
const modalTitulo      = document.getElementById('modal-servicio-titulo');
const servicioIdInput  = document.getElementById('servicio-id');
const servicioNombre   = document.getElementById('servicio-nombre');
const servicioPrecios  = document.getElementById('servicio-precio');
const modulosLista     = document.getElementById('modulos-lista');

/* =====================================================
   CARGA DE DATOS
   ===================================================== */

/**
 * Carga servicios.json y renderiza el catálogo.
 * En producción (Netlify) se hace un fetch real;
 * en desarrollo local con live-server también funciona.
 */
async function cargarDatos() {
  try {
    const res = await fetch('data/servicios.json');
    if (!res.ok) throw new Error('No se pudo cargar servicios.json');
    const data = await res.json();
    servicios = data.servicios;
    renderizarCatalogo();
  } catch (err) {
    console.error('Error cargando datos:', err);
    serviciosList.innerHTML = `<p style="color:var(--color-danger);padding:20px">
      Error al cargar los servicios. Asegurate de servir el proyecto con un servidor local.</p>`;
  }
}

/**
 * Persiste el arreglo `servicios` en el JSON local.
 * Nota: en un entorno estático no hay backend,
 * por lo que este guardado es sólo en memoria durante la sesión.
 * Para persistencia real se requeriría un backend o localStorage.
 */
function guardarDatos() {
  // En una app 100% estática no podemos escribir al JSON desde el navegador.
  // Usamos localStorage como alternativa ligera para persistir cambios.
  localStorage.setItem('cotis_servicios', JSON.stringify(servicios));
}

/**
 * Inicializa los datos: primero intenta localStorage (cambios del usuario),
 * si no existe carga el JSON original.
 */
async function inicializar() {
  const guardado = localStorage.getItem('cotis_servicios');
  if (guardado) {
    servicios = JSON.parse(guardado);
    paginaServicios = 1;
    renderizarCatalogo();
  } else {
    await cargarDatos();
  }
}

/* =====================================================
   RENDERIZADO DEL CATÁLOGO
   ===================================================== */

/**
 * Renderiza las tarjetas de servicios de la página actual.
 */
function renderizarCatalogo() {
  serviciosList.innerHTML = '';

  if (servicios.length === 0) {
    serviciosList.innerHTML = '<p style="color:var(--color-text-muted);padding:20px;text-align:center">Sin servicios. Creá uno nuevo.</p>';
    return;
  }

  const totalPaginas = Math.ceil(servicios.length / SERVICIOS_POR_PAGINA);
  const inicio = (paginaServicios - 1) * SERVICIOS_POR_PAGINA;
  const fin    = paginaServicios * SERVICIOS_POR_PAGINA;
  const serviciosPagina = servicios.slice(inicio, fin);

  serviciosPagina.forEach(servicio => {
    const card = crearTarjetaServicio(servicio);
    serviciosList.appendChild(card);
  });

  // Renderizar paginación si hay más de una página
  if (totalPaginas > 1) {
    const paginacion = document.createElement('div');
    paginacion.className = 'pagination';
    paginacion.innerHTML = `
      <button id="btn-pag-prev" class="btn btn--ghost btn--sm" ${paginaServicios === 1 ? 'disabled' : ''}>← Ant</button>
      <span class="pagination__info">Página ${paginaServicios} de ${totalPaginas}</span>
      <button id="btn-pag-next" class="btn btn--ghost btn--sm" ${paginaServicios === totalPaginas ? 'disabled' : ''}>Sig →</button>
    `;
    paginacion.querySelector('#btn-pag-prev').addEventListener('click', irPaginaAnterior);
    paginacion.querySelector('#btn-pag-next').addEventListener('click', irPaginaSiguiente);
    serviciosList.appendChild(paginacion);
  }
}

/**
 * Va a la página anterior del catálogo.
 */
function irPaginaAnterior() {
  if (paginaServicios > 1) { paginaServicios--; renderizarCatalogo(); }
}

/**
 * Va a la página siguiente del catálogo.
 */
function irPaginaSiguiente() {
  const total = Math.ceil(servicios.length / SERVICIOS_POR_PAGINA);
  if (paginaServicios < total) { paginaServicios++; renderizarCatalogo(); }
}

/**
 * Crea el elemento DOM de una tarjeta de servicio.
 */
function crearTarjetaServicio(servicio) {
  const seleccionado = estaSeleccionado('servicio', servicio.id);

  const card = document.createElement('div');
  card.className = 'servicio-card';
  card.dataset.servicioId = servicio.id;

  card.innerHTML = `
    <div class="servicio-card__header">
      <div class="servicio-card__info">
        <input type="checkbox" class="servicio-card__checkbox" ${seleccionado ? 'checked' : ''}
               data-servicio-id="${servicio.id}" />
        <span class="servicio-card__nombre">${escapar(servicio.nombre)}</span>
      </div>
      <span class="servicio-card__precio">${formatearPrecio(servicio.precio_base)}</span>
      <div class="servicio-card__actions">
        <button class="btn btn--ghost btn--sm" data-editar="${servicio.id}">Editar</button>
        <button class="btn btn--danger btn--sm" data-eliminar="${servicio.id}">Eliminar</button>
        <button class="servicio-card__toggle" data-toggle="${servicio.id}">▾</button>
      </div>
    </div>
    <div class="servicio-card__modulos hidden" id="modulos-${servicio.id}">
      ${servicio.modulos.length === 0
        ? '<p style="color:var(--color-text-muted);font-size:13px">Sin módulos adicionales.</p>'
        : servicio.modulos.map(m => crearModuloHTML(servicio.id, m)).join('')
      }
    </div>
  `;

  // Evento: checkbox del servicio
  card.querySelector(`[data-servicio-id="${servicio.id}"]`)
    .addEventListener('change', e => toggleServicio(servicio.id, e.target.checked));

  // Evento: checkboxes de módulos
  card.querySelectorAll('[data-modulo-id]').forEach(cb => {
    cb.addEventListener('change', e => {
      toggleModulo(servicio.id, parseInt(e.target.dataset.moduloId), e.target.checked);
    });
  });

  // Evento: expandir/colapsar módulos
  card.querySelector(`[data-toggle="${servicio.id}"]`)
    .addEventListener('click', () => toggleModulosVisibles(servicio.id));

  // Evento: editar servicio
  card.querySelector(`[data-editar="${servicio.id}"]`)
    .addEventListener('click', e => { e.stopPropagation(); abrirModalEditar(servicio.id); });

  // Evento: eliminar servicio
  card.querySelector(`[data-eliminar="${servicio.id}"]`)
    .addEventListener('click', e => { e.stopPropagation(); eliminarServicio(servicio.id); });

  return card;
}

/**
 * Genera el HTML de un módulo dentro de una tarjeta.
 */
function crearModuloHTML(servicioId, modulo) {
  const sel = estaSeleccionado('modulo', servicioId, modulo.id);
  return `
    <div class="modulo-item ${sel ? 'selected' : ''}" data-modulo-wrap="${modulo.id}">
      <input type="checkbox" class="modulo-item__checkbox" ${sel ? 'checked' : ''}
             data-modulo-id="${modulo.id}" />
      <span class="modulo-item__nombre">${escapar(modulo.nombre)}</span>
      <span class="modulo-item__precio">${formatearPrecio(modulo.precio)}</span>
    </div>
  `;
}

/**
 * Muestra u oculta los módulos de un servicio.
 */
function toggleModulosVisibles(servicioId) {
  const panel = document.getElementById(`modulos-${servicioId}`);
  const btn = document.querySelector(`[data-toggle="${servicioId}"]`);
  panel.classList.toggle('hidden');
  btn.textContent = panel.classList.contains('hidden') ? '▾' : '▴';
}

/* =====================================================
   COTIZACIÓN
   ===================================================== */

/**
 * Agrega o quita el servicio base de la cotización.
 */
function toggleServicio(servicioId, agregar) {
  const servicio = servicios.find(s => s.id === servicioId);
  if (!servicio) return;

  if (agregar) {
    if (!estaSeleccionado('servicio', servicioId)) {
      cotizacion.items.push({
        tipo: 'servicio',
        servicioId,
        nombre: servicio.nombre,
        precio: servicio.precio_base,
        descripcion: ''
      });
    }
  } else {
    // Quitar servicio y todos sus módulos
    cotizacion.items = cotizacion.items.filter(
      i => !(i.tipo === 'servicio' && i.servicioId === servicioId) &&
           !(i.tipo === 'modulo'   && i.servicioId === servicioId)
    );
    // Desmarcar checkboxes de módulos en el DOM
    document.querySelectorAll(`#modulos-${servicioId} [data-modulo-id]`).forEach(cb => {
      cb.checked = false;
      cb.closest('.modulo-item')?.classList.remove('selected');
    });
  }

  renderizarCotizacion();
}

/**
 * Agrega o quita un módulo de la cotización.
 */
function toggleModulo(servicioId, moduloId, agregar) {
  const servicio = servicios.find(s => s.id === servicioId);
  if (!servicio) return;
  const modulo = servicio.modulos.find(m => m.id === moduloId);
  if (!modulo) return;

  // Actualizar estilo del ítem
  const wrap = document.querySelector(`[data-modulo-wrap="${moduloId}"]`);
  if (wrap) wrap.classList.toggle('selected', agregar);

  if (agregar) {
    if (!estaSeleccionado('modulo', servicioId, moduloId)) {
      cotizacion.items.push({
        tipo: 'modulo',
        servicioId,
        moduloId,
        nombre: modulo.nombre,
        precio: modulo.precio,
        descripcion: ''
      });
    }
  } else {
    cotizacion.items = cotizacion.items.filter(
      i => !(i.tipo === 'modulo' && i.servicioId === servicioId && i.moduloId === moduloId)
    );
  }

  renderizarCotizacion();
}

/**
 * Verifica si un ítem ya está en la cotización.
 */
function estaSeleccionado(tipo, servicioId, moduloId = null) {
  if (tipo === 'servicio') {
    return cotizacion.items.some(i => i.tipo === 'servicio' && i.servicioId === servicioId);
  }
  return cotizacion.items.some(
    i => i.tipo === 'modulo' && i.servicioId === servicioId && i.moduloId === moduloId
  );
}

/**
 * Devuelve los ítems agrupados: cada servicio seguido inmediatamente
 * de sus módulos, respetando el orden en que se seleccionaron los servicios.
 */
function getItemsAgrupados() {
  const vistos = new Set();
  const resultado = [];
  cotizacion.items.forEach(i => {
    if (!vistos.has(i.servicioId)) {
      vistos.add(i.servicioId);
      // Primero el servicio base (si está seleccionado)
      const srv = cotizacion.items.find(x => x.tipo === 'servicio' && x.servicioId === i.servicioId);
      if (srv) resultado.push(srv);
      // Luego todos sus módulos
      cotizacion.items
        .filter(x => x.tipo === 'modulo' && x.servicioId === i.servicioId)
        .forEach(m => resultado.push(m));
    }
  });
  return resultado;
}

/**
 * Renderiza los ítems de la cotización en el panel derecho.
 */
function renderizarCotizacion() {
  quoteItems.innerHTML = '';

  if (cotizacion.items.length === 0) {
    quoteItems.innerHTML = '<p class="quote-empty">Seleccioná servicios y módulos del catálogo para armar la cotización.</p>';
    badgeItems.textContent = '0';
    actualizarTotales(0);
    return;
  }

  let total = 0;
  const agrupados = getItemsAgrupados();

  agrupados.forEach(item => {
    total += item.precio;
    const el = document.createElement('div');
    el.className = `quote-item quote-item--${item.tipo}`;
    el.innerHTML = `
      <div style="flex:1;min-width:0;">
        <div class="quote-item__nombre">${escapar(item.nombre)}</div>
        ${item.tipo === 'modulo' ? `<div class="quote-item__tag">Módulo</div>` : ''}
        <textarea class="quote-item__desc" rows="2" placeholder="Descripción para el documento...">${escapar(item.descripcion)}</textarea>
      </div>
      <span class="quote-item__precio">${formatearPrecio(item.precio)}</span>
    `;
    // Sincronizar descripción buscando el item por referencia (no por índice)
    el.querySelector('.quote-item__desc').addEventListener('input', e => {
      const target = cotizacion.items.find(x =>
        x.tipo === item.tipo &&
        x.servicioId === item.servicioId &&
        (item.tipo === 'servicio' || x.moduloId === item.moduloId)
      );
      if (target) target.descripcion = e.target.value;
    });
    quoteItems.appendChild(el);
  });

  badgeItems.textContent = cotizacion.items.length;
  actualizarTotales(total);
}

/**
 * Actualiza los totales mostrados, incluyendo IVA e ISR si aplican.
 */
function actualizarTotales(subtotal) {
  const ivaAmt = cotizacion.iva ? subtotal * 0.16 : 0;
  const isrAmt = subtotal * (cotizacion.isrPct / 100);
  const total  = subtotal + ivaAmt + isrAmt;

  totalSubtotal.textContent = formatearPrecio(subtotal);

  // Fila IVA
  const rowIva  = document.getElementById('row-iva');
  const totalIva = document.getElementById('total-iva');
  if (cotizacion.iva && ivaAmt > 0) {
    totalIva.textContent = formatearPrecio(ivaAmt);
    rowIva.style.display = '';
  } else {
    rowIva.style.display = 'none';
  }

  // Fila ISR
  const rowIsr   = document.getElementById('row-isr');
  const totalIsr = document.getElementById('total-isr');
  if (cotizacion.isrPct > 0 && isrAmt > 0) {
    totalIsr.textContent = formatearPrecio(isrAmt);
    rowIsr.style.display = '';
  } else {
    rowIsr.style.display = 'none';
  }

  totalFinal.textContent = formatearPrecio(total);
}

/**
 * Recalcula impuestos leyendo el estado actual de la cotización.
 */
function recalcularImpuestos() {
  const subtotal = cotizacion.items.reduce((acc, i) => acc + i.precio, 0);
  actualizarTotales(subtotal);
}

/**
 * Limpia toda la cotización.
 */
function limpiarCotizacion() {
  cotizacion.items = [];
  clienteNombre.value   = '';
  clienteProyecto.value = '';
  textoIntro.value      = '';
  textoTiempos.value    = '';
  textoTerminos.value   = '';
  // Desmarcar todos los checkboxes
  document.querySelectorAll('.servicio-card__checkbox, .modulo-item__checkbox').forEach(cb => {
    cb.checked = false;
  });
  document.querySelectorAll('.modulo-item').forEach(el => el.classList.remove('selected'));
  renderizarCotizacion();
}

/* =====================================================
   EXPORTAR PDF
   ===================================================== */

/**
 * Genera un PDF de la cotización usando html2pdf.js
 * y el template en /templates/cotizacion.html.
 */
async function exportarPDF() {
  if (cotizacion.items.length === 0) {
    alert('Agregá al menos un servicio a la cotización antes de exportar.');
    return;
  }

  const btnExportar = document.getElementById('btn-exportar-pdf');
  btnExportar.disabled    = true;
  btnExportar.textContent = 'Generando PDF…';

  let wrapper = null;

  try {
    const clienteRaw  = clienteNombre.value.trim()  || '—';
    const proyectoRaw = clienteProyecto.value.trim() || '—';
    const fecha       = new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'long', year:'numeric' });
    const nro         = String(Date.now()).slice(-6);
    const subtotal    = cotizacion.items.reduce((acc, i) => acc + i.precio, 0);
    const ivaAmt      = cotizacion.iva ? subtotal * 0.16 : 0;
    const isrAmt      = subtotal * (cotizacion.isrPct / 100);
    const total       = subtotal + ivaAmt + isrAmt;

    // Factor para distribuir impuestos proporcionalmente en cada fila
    const taxFactor = subtotal > 0 ? total / subtotal : 1;

    // Usar items agrupados (servicio + sus módulos juntos) para la tabla
    const filasItems = getItemsAgrupados();
    const filas = filasItems.map((item, idx) => {
      const precioAjustado = item.precio * taxFactor;
      return `
        <tr>
          <td style="width:36px;text-align:center;padding:10px 8px;border:1px solid #e0e0e0;color:#999;font-size:11px;">${idx + 1}</td>
          <td style="padding:10px 14px;border:1px solid #e0e0e0;font-size:13px;color:#2d2d2d;">${escapar(item.nombre)}</td>
          <td style="padding:10px 14px;border:1px solid #e0e0e0;font-size:11px;color:#777;width:120px;">${item.tipo === 'servicio' ? 'Servicio base' : 'Módulo'}</td>
          <td style="padding:10px 14px;border:1px solid #e0e0e0;text-align:right;font-weight:700;color:#1e6f80;width:120px;">${formatearPrecio(precioAjustado)}</td>
        </tr>
      `;
    }).join('');

    // Cargar logo como base64 para que html2canvas lo renderice sin problemas de CORS
    let logoHTML = '<div style="width:72px;height:72px;border:2px solid #1e6f80;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#1e6f80;font-weight:700;">LOGO</div>';
    try {
      const logoBlob   = await fetch('templates/logo.png').then(r => r.blob());
      const logoBase64 = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(logoBlob);
      });
      logoHTML = `<img src="${logoBase64}" style="height:72px;width:auto;display:block;" />`;
    } catch (_) { /* usa placeholder si no carga */ }

    const estructuraHTML = generarEstructura();
    const introHTML      = textoAParrafos(textoIntro.value    || 'Sin descripción.');
    const tiemposHTML    = textoAParrafos(textoTiempos.value  || 'A coordinar con el cliente.');
    const terminosHTML   = textoAParrafos(textoTerminos.value || 'A definir.');

    // Construir HTML completo con estilos inline para máxima compatibilidad con html2canvas
    const html = `
      <div style="font-family:'Times New Roman',Times,serif;color:#1a1a2e;font-size:13.5px;background:#fff;padding:48px 56px;width:794px;">

        <!-- Logo -->
        <div style="display:flex;justify-content:flex-end;margin-bottom:40px;">
          ${logoHTML}
        </div>

        <!-- Título -->
        <div style="text-align:center;font-size:17px;font-weight:700;margin-bottom:36px;line-height:1.4;">
          ${clienteNombre.value.trim() === ''
            ? `Cotización del proyecto &ldquo;${escapar(proyectoRaw)}&rdquo;`
            : `Cotización del proyecto &ldquo;${escapar(proyectoRaw)}&rdquo;<br>para la empresa &ldquo;${escapar(clienteRaw)}&rdquo;`
          }
        </div>

        <!-- Introducción (sin etiqueta) -->
        <div style="margin-bottom:28px;">
          <div style="font-size:13px;line-height:1.7;color:#1a1a2e;padding:0;">${introHTML}</div>
        </div>

        <!-- Estructura operativa -->
        <div style="margin-bottom:28px;">
          <div style="font-size:14px;font-weight:700;margin-bottom:10px;"><strong>Estructura operativa y alcance:</strong></div>
          <div style="font-size:13px;line-height:1.7;color:#1a1a2e;padding:0;">${estructuraHTML}</div>
        </div>

        <!-- Tabla de precios -->
        <div style="margin-bottom:28px;">
          <div style="font-size:14px;font-weight:700;margin-bottom:10px;"><strong>Tabla de precios:</strong></div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #d0d0d0;">
            <thead>
              <tr style="background:#1e6f80;">
                <th style="width:36px;padding:10px 8px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff;border:1px solid #1a6272;">#</th>
                <th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff;border:1px solid #1a6272;">Descripción</th>
                <th style="width:120px;padding:10px 14px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff;border:1px solid #1a6272;">Tipo</th>
                <th style="width:120px;padding:10px 14px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff;border:1px solid #1a6272;">Precio</th>
              </tr>
            </thead>
            <tbody>
              ${filas}
              <tr>
                <td style="padding:10px 8px;border:1px solid #1a6272;background:#1e6f80;"></td>
                <td colspan="2" style="padding:10px 14px;border:1px solid #1a6272;background:#1e6f80;color:#fff;font-weight:700;font-size:14px;">Total estimado</td>
                <td style="padding:10px 14px;border:1px solid #1a6272;background:#1e6f80;text-align:right;color:#fff;font-weight:700;font-size:16px;">${formatearPrecio(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Tiempos de entrega -->
        <div style="margin-bottom:28px;">
          <div style="font-size:14px;font-weight:700;margin-bottom:10px;"><strong>Tiempos de entrega:</strong></div>
          <div style="font-size:13px;line-height:1.7;color:#1a1a2e;padding:0;">${tiemposHTML}</div>
        </div>

        <!-- Términos y condiciones -->
        <div style="margin-bottom:28px;">
          <div style="font-size:14px;font-weight:700;margin-bottom:10px;"><strong>Términos y condiciones:</strong></div>
          <div style="font-size:13px;line-height:1.7;color:#1a1a2e;padding:0;">${terminosHTML}</div>
        </div>

        <!-- Espacio reservado para el pie de página (lo agrega jsPDF) -->
        <div style="height:20mm;"></div>

      </div>
    `;

    // Insertar con position:fixed para que siempre quede en (0,0) del viewport
    // independientemente del scroll actual
    wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;background:#fff;';
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);

    await new Promise(r => setTimeout(r, 200));

    const nombreArchivo = `cotizacion-${proyectoRaw.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;

    await html2pdf()
      .set({
        margin:      0,
        filename:    nombreArchivo,
        image:       { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0 },
        jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' }
      })
      .from(wrapper.firstElementChild)
      .toPdf()
      .get('pdf')
      .then(pdf => {
        // Agregar pie de página en todas las páginas
        const totalPags = pdf.internal.getNumberOfPages();
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        for (let p = 1; p <= totalPags; p++) {
          pdf.setPage(p);
          pdf.setFontSize(8);
          pdf.setTextColor(180, 180, 180);
          pdf.line(14, ph - 12, pw - 14, ph - 12); // línea separadora
          pdf.text(fecha, 14, ph - 7);
          pdf.text(`COT-${nro}`, pw - 14, ph - 7, { align: 'right' });
        }
      })
      .save();

  } catch (err) {
    console.error('Error generando PDF:', err);
    alert('Error al generar el PDF. Revisá la consola.');
  } finally {
    if (wrapper) document.body.removeChild(wrapper);
    btnExportar.disabled    = false;
    btnExportar.textContent = 'Exportar PDF';
  }
}

/* =====================================================
   CRUD SERVICIOS
   ===================================================== */

/**
 * Abre el modal para crear un nuevo servicio.
 */
function abrirModalNuevo() {
  modalTitulo.textContent   = 'Nuevo servicio';
  servicioIdInput.value     = '';
  servicioNombre.value      = '';
  servicioPrecios.value     = '';
  modulosLista.innerHTML    = '';
  modalServicio.hidden      = false;
}

/**
 * Abre el modal con los datos de un servicio existente para editar.
 */
function abrirModalEditar(id) {
  const servicio = servicios.find(s => s.id === id);
  if (!servicio) return;

  modalTitulo.textContent = 'Editar servicio';
  servicioIdInput.value   = servicio.id;
  servicioNombre.value    = servicio.nombre;
  servicioPrecios.value   = servicio.precio_base;

  modulosLista.innerHTML = '';
  servicio.modulos.forEach(m => agregarFilaModulo(m.nombre, m.precio, m.id));

  modalServicio.hidden = false;
}

/**
 * Cierra el modal de servicio.
 */
function cerrarModal() {
  modalServicio.hidden = true;
}

/**
 * Agrega una fila de módulo en el editor del modal.
 */
function agregarFilaModulo(nombre = '', precio = '', id = null) {
  const fila = document.createElement('div');
  fila.className = 'modulo-editor-row';
  fila.dataset.moduloId = id ?? '';

  fila.innerHTML = `
    <input class="form-input" type="text"   placeholder="Nombre del módulo" value="${escapar(nombre)}" />
    <input class="form-input form-input--precio" type="number" placeholder="Precio" min="0" value="${precio}" />
    <button class="btn--icon" title="Eliminar módulo">✕</button>
  `;

  fila.querySelector('.btn--icon').addEventListener('click', () => fila.remove());
  modulosLista.appendChild(fila);
}

/**
 * Guarda el servicio (nuevo o editado) y actualiza la vista.
 */
function guardarServicio() {
  const nombre = servicioNombre.value.trim();
  const precio = parseFloat(servicioPrecios.value);

  if (!nombre) { alert('El nombre del servicio es obligatorio.'); return; }
  if (isNaN(precio) || precio < 0) { alert('Ingresá un precio base válido.'); return; }

  // Leer módulos del editor
  const modulos = [];
  modulosLista.querySelectorAll('.modulo-editor-row').forEach((fila, idx) => {
    const [inpNombre, inpPrecio] = fila.querySelectorAll('input');
    const n = inpNombre.value.trim();
    const p = parseFloat(inpPrecio.value);
    if (n && !isNaN(p) && p >= 0) {
      modulos.push({
        id:     parseInt(fila.dataset.moduloId) || generarId(),
        nombre: n,
        precio: p
      });
    }
  });

  const idExistente = parseInt(servicioIdInput.value);

  if (idExistente) {
    // Editar existente
    const idx = servicios.findIndex(s => s.id === idExistente);
    if (idx !== -1) {
      servicios[idx] = { id: idExistente, nombre, precio_base: precio, modulos };
    }
  } else {
    // Nuevo
    servicios.push({ id: generarId(), nombre, precio_base: precio, modulos });
  }

  guardarDatos();
  renderizarCatalogo();
  cerrarModal();
}

/**
 * Elimina un servicio tras confirmación.
 */
function eliminarServicio(id) {
  const servicio = servicios.find(s => s.id === id);
  if (!servicio) return;
  if (!confirm(`¿Eliminás el servicio "${servicio.nombre}"? Esta acción no se puede deshacer.`)) return;

  servicios = servicios.filter(s => s.id !== id);
  // Quitar de la cotización si estaba
  cotizacion.items = cotizacion.items.filter(i => i.servicioId !== id);
  guardarDatos();
  renderizarCatalogo();
  renderizarCotizacion();
}

/* =====================================================
   UTILIDADES
   ===================================================== */

/**
 * Convierte texto plano (con saltos de línea) en párrafos HTML.
 */
function textoAParrafos(texto) {
  return texto.trim().split(/\n+/).map(l => `<p>${escapar(l)}</p>`).join('');
}

/**
 * Genera el HTML de estructura operativa a partir de los ítems seleccionados.
 */
function generarEstructura() {
  if (cotizacion.items.length === 0) return '<p>Sin servicios seleccionados.</p>';

  const serviciosSeleccionados = cotizacion.items.filter(i => i.tipo === 'servicio');
  let html = '';

  serviciosSeleccionados.forEach(srv => {
    const modulos = cotizacion.items.filter(i => i.tipo === 'modulo' && i.servicioId === srv.servicioId);
    html += `<p><strong>${escapar(srv.nombre)}</strong></p>`;
    if (srv.descripcion) {
      html += `<p style="padding-left:0;margin-bottom:6px;">${escapar(srv.descripcion)}</p>`;
    }
    if (modulos.length > 0) {
      modulos.forEach(m => {
        html += `<p style="padding-left:16px">• <strong>${escapar(m.nombre)}</strong></p>`;
        if (m.descripcion) {
          html += `<p style="padding-left:28px">${escapar(m.descripcion)}</p>`;
        }
      });
    }
  });

  return html || '<p>Sin servicios seleccionados.</p>';
}

/** Formatea un número como precio en pesos/dólares. */
function formatearPrecio(n) {
  return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Escapa HTML básico para evitar XSS. */
function escapar(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Genera un ID único simple basado en timestamp + random. */
function generarId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

/* =====================================================
   EVENT LISTENERS
   ===================================================== */

// Soporte de tabulaciones en textareas
document.addEventListener('keydown', function(e) {
  if (e.key === 'Tab' && e.target.tagName === 'TEXTAREA') {
    e.preventDefault();
    const ta = e.target;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    ta.value = ta.value.substring(0, start) + '\t' + ta.value.substring(end);
    ta.selectionStart = ta.selectionEnd = start + 1;
    ta.dispatchEvent(new Event('input'));
  }
});

// Botón nuevo servicio
document.getElementById('btn-nuevo-servicio')
  .addEventListener('click', abrirModalNuevo);

// Botón agregar módulo en el modal
document.getElementById('btn-agregar-modulo')
  .addEventListener('click', () => agregarFilaModulo());

// Cerrar modal
document.getElementById('modal-servicio-cerrar')
  .addEventListener('click', cerrarModal);
document.getElementById('btn-modal-cancelar')
  .addEventListener('click', cerrarModal);

// Cerrar modal clickeando fuera
modalServicio.addEventListener('click', e => {
  if (e.target === modalServicio) cerrarModal();
});

// Guardar servicio
document.getElementById('btn-modal-guardar')
  .addEventListener('click', guardarServicio);

// Limpiar cotización
document.getElementById('btn-limpiar')
  .addEventListener('click', () => {
    if (cotizacion.items.length === 0 || confirm('¿Limpiar toda la cotización?')) {
      limpiarCotizacion();
    }
  });

// Exportar PDF
document.getElementById('btn-exportar-pdf')
  .addEventListener('click', exportarPDF);

// Ver cotización (mobile: scroll al panel)
document.getElementById('btn-ver-cotizacion')
  .addEventListener('click', () => {
    document.getElementById('panel-quote').scrollIntoView({ behavior: 'smooth' });
  });

// Sincronizar datos del cliente
clienteNombre.addEventListener('input',   () => { cotizacion.cliente  = clienteNombre.value; });
clienteProyecto.addEventListener('input', () => { cotizacion.proyecto = clienteProyecto.value; });

// Toggle sección textos del documento
document.getElementById('btn-toggle-textos').addEventListener('click', function() {
  this.classList.toggle('open');
  document.getElementById('textos-body').classList.toggle('open');
});

// Checkbox IVA
document.getElementById('chk-iva').addEventListener('change', function() {
  cotizacion.iva = this.checked;
  recalcularImpuestos();
});

// Input ISR
document.getElementById('inp-isr').addEventListener('input', function() {
  cotizacion.isrPct = parseFloat(this.value) || 0;
  recalcularImpuestos();
});

/* =====================================================
   ARRANQUE
   ===================================================== */
inicializar();

"""
CDF Template Engine with Coordinate Overlay System
Uses the official Telugu CDF as a static background with interactive overlay fields.
"""
from datetime import datetime
import hashlib
import uuid


def generate_correlation_id():
    """Generate unique correlation ID for error tracking."""
    timestamp = datetime.now().strftime('%Y%m%d')
    unique = uuid.uuid4().hex[:4].upper()
    return f"CDF-{timestamp}-{unique}"


def generate_cdf_overlay_html(
    data: dict,
    correlation_id: str = None
) -> str:
    """
    Generate CDF HTML with exact overlay positioning matching Telugu template.
    The background is the official CDF structure, inputs overlay on dotted lines.
    """
    if not correlation_id:
        correlation_id = generate_correlation_id()
    
    # Extract data with defaults
    district = data.get('district', 'Narayanpet')
    ps = data.get('police_station', 'Makthal')
    year = data.get('year', '2026')
    fir_number = data.get('fir_number', '')
    fir_date = data.get('fir_date', '')
    sections = data.get('sections', '')
    
    # Scene informant
    scene_informant_name = data.get('scene_informant_name', '')
    scene_informant_father = data.get('scene_informant_father', '')
    scene_informant_address = data.get('scene_informant_address', '')
    
    # Crime details
    crime_heading = data.get('crime_heading', '')
    modus_operandi = data.get('modus_operandi', ['', '', ''])
    vehicle_used = data.get('vehicle_used', '')
    approach_method = data.get('approach_method', '')
    language_used = data.get('language_used', '')
    special_marks = data.get('special_marks', ['', '', ''])
    crime_location_type = data.get('crime_location_type', '')
    
    # Victim details
    victims = data.get('victims', [])
    
    # Crime purpose
    crime_purpose = data.get('crime_purpose', '')
    
    # Evidence
    evidence_details = data.get('evidence_details', '')
    
    # Property
    property_details = data.get('property_details', '')
    
    # Scene visit
    scene_visit_date = data.get('scene_visit_date', '')
    scene_visit_time = data.get('scene_visit_time', '')
    
    # Scene description
    scene_description = data.get('scene_description', '')
    
    # Scene sketch (Section 11) - used in template via direct variable reference
    _ = data.get('scene_sketch_data', '')
    
    # Witnesses
    witnesses = data.get('witnesses', [{}, {}])
    
    # Officer details
    officer_name = data.get('officer_name', '')
    officer_designation = data.get('officer_designation', '')
    officer_number = data.get('officer_number', '')
    officer_ps = data.get('officer_ps', ps)
    
    # Build victim rows HTML
    victim_rows_html = ""
    if victims:
        for i, v in enumerate(victims[:5]):
            victim_rows_html += f"""
                <tr>
                    <td>{i+1}</td>
                    <td><input type="text" class="overlay-input w-sm" value="{v.get('name', '')}" /></td>
                    <td><input type="text" class="overlay-input w-sm" value="{v.get('father', '')}" /></td>
                    <td><input type="text" class="overlay-input w-sm" value="{v.get('age', '')}" /></td>
                    <td><input type="text" class="overlay-input w-sm" value="{v.get('gender', '')}" /></td>
                    <td><input type="text" class="overlay-input w-sm" value="{v.get('nationality', 'Indian')}" /></td>
                    <td><input type="text" class="overlay-input w-sm" value="{v.get('religion', '')}" /></td>
                    <td><input type="text" class="overlay-input w-sm" value="{v.get('caste', '')}" /></td>
                    <td><input type="text" class="overlay-input w-sm" value="{v.get('occupation', '')}" /></td>
                    <td><input type="text" class="overlay-input" value="{v.get('address', '')}" /></td>
                    <td><input type="text" class="overlay-input w-sm" value="{v.get('injury', '')}" /></td>
                    <td><input type="text" class="overlay-input w-sm" value="{v.get('injury_type', '')}" /></td>
                </tr>
            """
    else:
        victim_rows_html = '<tr><td colspan="12">No victims entered</td></tr>'
    
    # Build modus operandi text
    modus_text = ""
    if isinstance(modus_operandi, list):
        modus_text = chr(10).join(modus_operandi)
    else:
        modus_text = modus_operandi
    
    # Build special marks
    special_mark_1 = special_marks[0] if len(special_marks) > 0 else ""
    special_mark_2 = special_marks[1] if len(special_marks) > 1 else ""
    special_mark_3 = special_marks[2] if len(special_marks) > 2 else ""
    
    # Build witnesses HTML
    def build_witness_row(witness, num):
        return f"""
        <div class="witness-block">
            <div class="witness-header">{num}.సాక్షి పేరు / Witness Name:</div>
            <div class="overlay-row">
                <span class="label">పేరు/Name:</span>
                <input type="text" class="overlay-input" value="{witness.get('name', '')}" data-field="witness_{num}_name" />
                <span class="label">తండ్రి/భర్త/S/o W/o:</span>
                <input type="text" class="overlay-input" value="{witness.get('father', '')}" data-field="witness_{num}_father" />
                <span class="label">సంతకము/Signature:</span>
                <div class="signature-box" data-field="witness_{num}_signature">_______________</div>
            </div>
            <div class="overlay-row">
                <span class="label">వయస్సు/Age:</span>
                <input type="text" class="overlay-input w-sm" value="{witness.get('age', '')}" data-field="witness_{num}_age" />
                <span class="label">కులము/Caste:</span>
                <input type="text" class="overlay-input w-sm" value="{witness.get('caste', '')}" data-field="witness_{num}_caste" />
                <span class="label">వృత్తి/Occupation:</span>
                <input type="text" class="overlay-input" value="{witness.get('occupation', '')}" data-field="witness_{num}_occupation" />
            </div>
            <div class="overlay-row">
                <span class="label">r/o Address:</span>
                <input type="text" class="overlay-input w-full" value="{witness.get('address', '')}" data-field="witness_{num}_address" />
            </div>
            <div class="overlay-row">
                <span class="label">Cell No.:</span>
                <input type="text" class="overlay-input" value="{witness.get('phone', '')}" data-field="witness_{num}_phone" />
            </div>
        </div>
        """
    
    witness_html = ""
    for i, w in enumerate(witnesses[:2], 1):
        witness_html += build_witness_row(w, i)
    
    # Generate the full overlay HTML
    html = f"""
<!DOCTYPE html>
<html lang="te">
<head>
    <meta charset="UTF-8">
    <title>Crime Details Form (CDF) - నేర వివరములు పత్రము</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;700&display=swap');
        
        @page {{
            size: A4;
            margin: 10mm;
        }}
        
        * {{
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Noto Sans Telugu', 'Noto Sans', Arial, sans-serif;
            font-size: 11px;
            line-height: 1.3;
            margin: 0;
            padding: 15px;
            background: #fff;
            color: #000;
        }}
        
        .cdf-container {{
            max-width: 210mm;
            margin: 0 auto;
            border: 2px solid #000;
            padding: 10px;
            position: relative;
        }}
        
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 1px solid #000;
            padding-bottom: 5px;
            margin-bottom: 10px;
        }}
        
        .header-logo {{
            width: 60px;
            height: 60px;
            border: 1px solid #999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 8px;
            text-align: center;
            background: #f9f9f9;
        }}
        
        .header-title {{
            flex: 1;
            text-align: center;
            font-weight: bold;
        }}
        
        .header-title h1 {{
            font-size: 14px;
            margin: 0 0 2px 0;
            letter-spacing: 3px;
        }}
        
        .header-title h2 {{
            font-size: 12px;
            margin: 0;
        }}
        
        .header-ref {{
            text-align: right;
            font-size: 9px;
        }}
        
        .section {{
            margin-bottom: 8px;
            position: relative;
        }}
        
        .section-num {{
            font-weight: bold;
            display: inline-block;
            width: 25px;
        }}
        
        .overlay-row {{
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 5px;
            margin: 3px 0;
        }}
        
        .label {{
            font-weight: bold;
            font-size: 10px;
        }}
        
        .overlay-input {{
            border: none;
            border-bottom: 1px dotted #000;
            background: transparent;
            padding: 2px 5px;
            font-family: inherit;
            font-size: 11px;
            min-width: 100px;
        }}
        
        .overlay-input:focus {{
            outline: none;
            border-bottom: 1px solid #00C2FF;
            background: rgba(0, 194, 255, 0.05);
        }}
        
        .overlay-input.w-sm {{
            min-width: 60px;
            max-width: 80px;
        }}
        
        .overlay-input.w-full {{
            flex: 1;
            min-width: 200px;
        }}
        
        .overlay-textarea {{
            border: 1px dotted #000;
            background: transparent;
            padding: 5px;
            font-family: inherit;
            font-size: 11px;
            width: 100%;
            min-height: 60px;
            resize: vertical;
        }}
        
        /* Section 11 - Scene Sketch Canvas */
        .scene-sketch-container {{
            border: 1px solid #000;
            min-height: 250px;
            margin: 10px 0;
            position: relative;
            background: #fafafa;
        }}
        
        .scene-sketch-canvas {{
            width: 100%;
            height: 250px;
            cursor: crosshair;
        }}
        
        .compass-icon {{
            position: absolute;
            top: 10px;
            right: 10px;
            width: 40px;
            height: 40px;
            cursor: move;
        }}
        
        .sketch-upload {{
            position: absolute;
            bottom: 10px;
            left: 10px;
            display: flex;
            gap: 10px;
        }}
        
        .sketch-upload-btn {{
            padding: 5px 10px;
            background: #00C2FF;
            color: #000;
            border: none;
            cursor: pointer;
            font-size: 10px;
        }}
        
        /* Witness Grid - Exact Layout */
        .witness-section {{
            border-top: 1px solid #000;
            padding-top: 10px;
            margin-top: 15px;
        }}
        
        .witness-block {{
            border: 1px solid #ccc;
            padding: 8px;
            margin-bottom: 10px;
            background: #fefefe;
        }}
        
        .witness-header {{
            font-weight: bold;
            margin-bottom: 5px;
            border-bottom: 1px dashed #999;
            padding-bottom: 3px;
        }}
        
        .signature-box {{
            display: inline-block;
            min-width: 100px;
            border-bottom: 1px solid #000;
            text-align: center;
            font-size: 10px;
            color: #999;
        }}
        
        /* Officer Signature Block */
        .officer-signature {{
            margin-top: 30px;
            text-align: right;
            border-top: 1px solid #000;
            padding-top: 15px;
        }}
        
        .officer-signature .sig-line {{
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin: 5px 0;
        }}
        
        .officer-signature .sig-label {{
            font-weight: bold;
        }}
        
        /* Victims Table */
        .victims-table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
            margin: 5px 0;
        }}
        
        .victims-table th, .victims-table td {{
            border: 1px solid #000;
            padding: 3px;
            text-align: center;
        }}
        
        .victims-table th {{
            background: #f0f0f0;
            font-weight: bold;
        }}
        
        /* Footer with Correlation ID */
        .footer {{
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px dashed #999;
            font-size: 8px;
            color: #666;
            display: flex;
            justify-content: space-between;
        }}
        
        @media print {{
            body {{
                padding: 0;
            }}
            .cdf-container {{
                border: 1px solid #000;
            }}
            .overlay-input {{
                border-bottom: 1px dotted #000 !important;
            }}
            .sketch-upload {{
                display: none;
            }}
        }}
    </style>
</head>
<body>
    <div class="cdf-container" id="cdf-form">
        <!-- Header -->
        <div class="header">
            <div class="header-logo">[TS POLICE LOGO]</div>
            <div class="header-title">
                <h1>CRIME DETAILS FORM</h1>
                <h2>నేర వివరములు పత్రము</h2>
            </div>
            <div class="header-ref">
                A.P.PM<br>
                Orders 892(1)<br>
                512, 515, 516
            </div>
        </div>
        
        <!-- Section 01: Basic Details -->
        <div class="section">
            <span class="section-num">01.</span>
            <span class="label">జిల్లా/District:</span>
            <input type="text" class="overlay-input" value="{district}" data-field="district" />
            <span class="label">పి.యస్/P.S.:</span>
            <input type="text" class="overlay-input" value="{ps}" data-field="ps" />
            <span class="label">సంII/Year:</span>
            <input type="text" class="overlay-input w-sm" value="{year}" data-field="year" />
            <span class="label">ప్రథమ సమాచార నివేదిక నెం/FIR No:</span>
            <input type="text" class="overlay-input w-sm" value="{fir_number}" data-field="fir_number" />
            <span class="label">తేది/Date:</span>
            <input type="text" class="overlay-input" value="{fir_date}" data-field="fir_date" />
        </div>
        
        <!-- Section 02: Acts & Sections -->
        <div class="section">
            <span class="section-num">02.</span>
            <span class="label">చట్టాలు మరియు విభాగములు / Acts & Sections:</span>
            <input type="text" class="overlay-input w-full" value="{sections}" data-field="sections" />
        </div>
        
        <!-- Section 03: Scene Informant -->
        <div class="section">
            <span class="section-num">03.</span>
            <span class="label">నేర స్థలమును చుపిన వారి పేరు / Scene Informant Name:</span>
            <input type="text" class="overlay-input" value="{scene_informant_name}" data-field="scene_informant_name" />
            <span class="label">తండ్రి/భర్త పేరు / Father/Husband:</span>
            <input type="text" class="overlay-input" value="{scene_informant_father}" data-field="scene_informant_father" />
            <div class="overlay-row">
                <span class="label">చిరునామా / Address:</span>
                <input type="text" class="overlay-input w-full" value="{scene_informant_address}" data-field="scene_informant_address" />
            </div>
        </div>
        
        <!-- Section 04: Modus Operandi -->
        <div class="section">
            <span class="section-num">04.</span>
            <span class="label">నేరము యొక్క (నేరము చేసిన తీరు పద్దతులు) / Modus Operandi:</span>
            <div class="overlay-row">
                <span class="label">1) ప్రధానశీర్షిక / Main Heading:</span>
                <input type="text" class="overlay-input w-full" value="{crime_heading}" data-field="crime_heading" />
            </div>
            <div class="overlay-row">
                <span class="label">2) పద్దతి / Method:</span>
                <textarea class="overlay-textarea" data-field="modus_operandi">{modus_text}</textarea>
            </div>
            <div class="overlay-row">
                <span class="label">3) ఉపయోగించిన వాహనము / Vehicle Used:</span>
                <input type="text" class="overlay-input w-full" value="{vehicle_used}" data-field="vehicle_used" />
            </div>
            <div class="overlay-row">
                <span class="label">4) అవలంబించిన తీరు / Approach Method:</span>
                <input type="text" class="overlay-input w-full" value="{approach_method}" data-field="approach_method" />
            </div>
            <div class="overlay-row">
                <span class="label">5) భాష / గ్రామం వాడిన తీరు / Language Used:</span>
                <input type="text" class="overlay-input w-full" value="{language_used}" data-field="language_used" />
            </div>
            <div class="overlay-row">
                <span class="label">6) ప్రత్యేక లక్షణము / Special Marks:</span>
                <input type="text" class="overlay-input" value="{special_mark_1}" data-field="special_mark_1" />
                <input type="text" class="overlay-input" value="{special_mark_2}" data-field="special_mark_2" />
                <input type="text" class="overlay-input" value="{special_mark_3}" data-field="special_mark_3" />
            </div>
            <div class="overlay-row">
                <span class="label">7) నేరము జరిగినస్థలము రకము / Crime Location Type:</span>
                <input type="text" class="overlay-input w-full" value="{crime_location_type}" data-field="crime_location_type" />
            </div>
        </div>
        
        <!-- Section 05: Victim Details -->
        <div class="section">
            <span class="section-num">05.</span>
            <span class="label">అస్తి రకము / బాదితులు వివరములు / Property Type / Victim Details:</span>
            <table class="victims-table">
                <tr>
                    <th>నెం</th>
                    <th>పేరు/Name</th>
                    <th>తండ్రి/భర్త/Father</th>
                    <th>వయస్సు/Age</th>
                    <th>మగ/ఆడ/M/F</th>
                    <th>జాతీయత/Nationality</th>
                    <th>మతం/Religion</th>
                    <th>కులము/Caste</th>
                    <th>వృత్తి/Occupation</th>
                    <th>చిరునామా/Address</th>
                    <th>గాయం/Injury</th>
                    <th>గాయం విధానం/Injury Type</th>
                </tr>
                {victim_rows_html}
            </table>
        </div>
        
        <!-- Section 06: Crime Purpose -->
        <div class="section">
            <span class="section-num">06.</span>
            <span class="label">నేర ఉద్దేశ్యము / Crime Purpose:</span>
            <input type="text" class="overlay-input w-full" value="{crime_purpose}" data-field="crime_purpose" />
        </div>
        
        <!-- Section 07: Evidence Details -->
        <div class="section">
            <span class="section-num">07.</span>
            <span class="label">నేర పరిశోధన నిమిత్తము స్వాధీనపరుచుకున్న భౌతిక సాక్షముల వివరములు / Physical Evidence Seized:</span>
            <textarea class="overlay-textarea" data-field="evidence_details">{evidence_details}</textarea>
        </div>
        
        <!-- Section 08: Property Details -->
        <div class="section">
            <span class="section-num">08.</span>
            <span class="label">అపహరించిన / ప్రమేయమున్న అస్తి వివరములు / Property Involved:</span>
            <textarea class="overlay-textarea" data-field="property_details">{property_details}</textarea>
        </div>
        
        <!-- Section 09: Scene Visit -->
        <div class="section">
            <span class="section-num">09.</span>
            <span class="label">నేరము జరిగిన స్థలముకు వెళ్ళిన / Scene Visit:</span>
            <span class="label">తేది/Date:</span>
            <input type="text" class="overlay-input" value="{scene_visit_date}" data-field="scene_visit_date" />
            <span class="label">సమయము/Time:</span>
            <input type="text" class="overlay-input" value="{scene_visit_time}" data-field="scene_visit_time" />
        </div>
        
        <!-- Section 10: Scene Description -->
        <div class="section">
            <span class="section-num">10.</span>
            <span class="label">నేర స్థలము యొక్క వర్ణన / Scene Description:</span>
            <textarea class="overlay-textarea" style="min-height: 100px;" data-field="scene_description">{scene_description}</textarea>
        </div>
        
        <!-- Section 11: Scene Sketch (Interactive Canvas) -->
        <div class="section">
            <span class="section-num">11.</span>
            <span class="label">నేర స్థలము యొక్క రేఖా చిత్రము / Scene Sketch:</span>
            <p style="font-size: 9px; color: #666;">(అవసరమైనచో విడిగా కాగితము పై నేరస్థుల రేఖా చిత్రము వివరణ వ్రాసి జతపరచుము, స్కేలు ప్రాకారమైన కొలతలు సూచించుము, సాక్షుల సంతకము పొందవలెను)</p>
            <div class="scene-sketch-container" id="sketch-container">
                <canvas class="scene-sketch-canvas" id="sketch-canvas"></canvas>
                <svg class="compass-icon" id="compass" viewBox="0 0 100 100" draggable="true">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#000" stroke-width="2"/>
                    <polygon points="50,10 45,50 50,45 55,50" fill="#FF0000"/>
                    <polygon points="50,90 45,50 50,55 55,50" fill="#000"/>
                    <text x="50" y="8" text-anchor="middle" font-size="8" font-weight="bold">N</text>
                    <text x="50" y="98" text-anchor="middle" font-size="8">S</text>
                    <text x="5" y="53" text-anchor="middle" font-size="8">W</text>
                    <text x="95" y="53" text-anchor="middle" font-size="8">E</text>
                </svg>
                <div class="sketch-upload">
                    <input type="file" id="sketch-upload-input" accept="image/*" style="display:none;" />
                    <button class="sketch-upload-btn" onclick="document.getElementById('sketch-upload-input').click()">📁 Upload Sketch</button>
                    <button class="sketch-upload-btn" onclick="clearSketch()">🗑️ Clear</button>
                </div>
            </div>
        </div>
        
        <!-- Witness Section - Exact Grid Layout -->
        <div class="witness-section">
            <h3 style="font-size: 12px; margin-bottom: 10px;">సాక్షుల వివరములు / WITNESS DETAILS</h3>
            {witness_html}
        </div>
        
        <!-- Officer Signature Block -->
        <div class="officer-signature">
            <div style="text-align: center; margin-bottom: 10px;">పోలీసు స్టేషను ఇంచార్జి, అధికారి సంతకము</div>
            <div style="text-align: center; margin-bottom: 10px;">SHO / Officer In-charge Signature</div>
            <div class="sig-line">
                <span class="sig-label">పేరు/Name:</span>
                <input type="text" class="overlay-input" value="{officer_name}" data-field="officer_name" />
            </div>
            <div class="sig-line">
                <span class="sig-label">హొదా/Designation:</span>
                <input type="text" class="overlay-input" value="{officer_designation}" data-field="officer_designation" />
                <span class="sig-label">నెం/No:</span>
                <input type="text" class="overlay-input w-sm" value="{officer_number}" data-field="officer_number" />
            </div>
            <div class="sig-line">
                <span class="sig-label">పి.యస్/P.S.:</span>
                <input type="text" class="overlay-input" value="{officer_ps}" data-field="officer_ps" />
            </div>
        </div>
        
        <!-- Footer with Correlation ID -->
        <div class="footer">
            <span>Generated: {datetime.now().strftime('%d.%m.%Y %H:%M:%S')}</span>
            <span>Correlation ID: <strong>{correlation_id}</strong></span>
        </div>
    </div>
    
    <script>
        // Scene Sketch Interactive Canvas
        const canvas = document.getElementById('sketch-canvas');
        const ctx = canvas.getContext('2d');
        let isDrawing = false;
        let uploadedImage = null;
        
        // Set canvas size
        function resizeCanvas() {{
            const container = document.getElementById('sketch-container');
            canvas.width = container.clientWidth - 4;
            canvas.height = 250;
            if (uploadedImage) {{
                drawUploadedImage();
            }}
        }}
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        // Drawing functionality
        canvas.addEventListener('mousedown', (e) => {{
            isDrawing = true;
            ctx.beginPath();
            ctx.moveTo(e.offsetX, e.offsetY);
        }});
        
        canvas.addEventListener('mousemove', (e) => {{
            if (!isDrawing) return;
            ctx.lineTo(e.offsetX, e.offsetY);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.stroke();
        }});
        
        canvas.addEventListener('mouseup', () => isDrawing = false);
        canvas.addEventListener('mouseout', () => isDrawing = false);
        
        // Upload sketch image
        document.getElementById('sketch-upload-input').addEventListener('change', (e) => {{
            const file = e.target.files[0];
            if (file) {{
                const reader = new FileReader();
                reader.onload = (event) => {{
                    uploadedImage = new Image();
                    uploadedImage.onload = drawUploadedImage;
                    uploadedImage.src = event.target.result;
                }};
                reader.readAsDataURL(file);
            }}
        }});
        
        function drawUploadedImage() {{
            if (!uploadedImage) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const scale = Math.min(canvas.width / uploadedImage.width, canvas.height / uploadedImage.height);
            const x = (canvas.width - uploadedImage.width * scale) / 2;
            const y = (canvas.height - uploadedImage.height * scale) / 2;
            ctx.drawImage(uploadedImage, x, y, uploadedImage.width * scale, uploadedImage.height * scale);
        }}
        
        function clearSketch() {{
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            uploadedImage = null;
        }}
        
        // Draggable compass
        const compass = document.getElementById('compass');
        let isDragging = false;
        let dragOffset = {{ x: 0, y: 0 }};
        
        compass.addEventListener('mousedown', (e) => {{
            isDragging = true;
            const rect = compass.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            e.preventDefault();
        }});
        
        document.addEventListener('mousemove', (e) => {{
            if (!isDragging) return;
            const container = document.getElementById('sketch-container');
            const containerRect = container.getBoundingClientRect();
            compass.style.left = (e.clientX - containerRect.left - dragOffset.x) + 'px';
            compass.style.top = (e.clientY - containerRect.top - dragOffset.y) + 'px';
            compass.style.right = 'auto';
        }});
        
        document.addEventListener('mouseup', () => isDragging = false);
        
        // Print function
        function printCDF() {{
            window.print();
        }}
    </script>
</body>
</html>
"""
    return html

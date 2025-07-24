from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from pydub import AudioSegment
import os
import numpy as np
from tensorflow.keras.models import load_model  # type: ignore
from utils.preprocess import extract_features_segments

app = Flask(__name__)
CORS(app, origins="http://localhost:5173")

app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['ALLOWED_EXTENSIONS'] = {'wav', 'mp3'}

model = load_model('model/crnn_model_fold4.h5')

label_to_genre = {
    0: "hiphop", 1: "country", 2: "classical", 3: "rock", 4: "pop",
    5: "jazz", 6: "reggae", 7: "disco", 8: "blues", 9: "metal"
}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def get_unique_filename(directory, base_filename, extension):
    """
    Menghasilkan nama file unik di folder `directory`.
    Jika base_filename.ext sudah ada, akan menjadi base_filename-1.ext, dst.
    """
    candidate = f"{base_filename}.{extension}"
    i = 1
    while os.path.exists(os.path.join(directory, candidate)):
        candidate = f"{base_filename}-{i}.{extension}"
        i += 1
    return candidate

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file uploaded"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "Empty filename"}), 400

    try:
        start = float(request.form.get('start', 0))
        end = float(request.form.get('end', 30))
    except:
        return jsonify({"success": False, "error": "Start/End region tidak valid"}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        base_filename = filename.rsplit('.', 1)[0]
        original_ext = filename.rsplit('.', 1)[1].lower()

        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        unique_filename = get_unique_filename(app.config['UPLOAD_FOLDER'], base_filename, original_ext)
        saved_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(saved_path)

        base_filename = unique_filename.rsplit('.', 1)[0]

        try:
            audio = AudioSegment.from_file(saved_path)
            segment_audio = audio[start * 1000:end * 1000]
            wav_path = os.path.join(app.config['UPLOAD_FOLDER'], base_filename + "_seg.wav")
            segment_audio.export(wav_path, format='wav')
            os.remove(saved_path)
        except Exception as e:
            return jsonify({"success": False, "error": f"Audio processing failed: {str(e)}"}), 500

        features = extract_features_segments(wav_path)
        if features is None or len(features) == 0:
            return jsonify({"success": False, "error": "Feature extraction failed or audio too short"}), 500

        try:
            predictions = model.predict(features)
        except Exception as e:
            return jsonify({"success": False, "error": f"Model prediction failed: {str(e)}"}), 500

        votes = {}
        for pred in predictions:
            genre_index = np.argmax(pred)
            genre = label_to_genre[genre_index]
            votes[genre] = votes.get(genre, 0) + 1

        total_votes = sum(votes.values())
        results = [
            {
                "genre": genre,
                "percentage": round((count / total_votes) * 100, 2)
            }
            for genre, count in sorted(votes.items(), key=lambda x: x[1], reverse=True)
        ]

        top_genre = results[0] if results else {"genre": "unknown", "percentage": 0}

        return jsonify({
            "success": True,
            "data": {
                "segment_count": total_votes,
                "results": results,
                "top_prediction": {
                    "genre": top_genre["genre"],
                    "confidence": top_genre["percentage"]
                }
            }
        })

    return jsonify({"success": False, "error": "Invalid file type. Only MP3 and WAV allowed"}), 400

if __name__ == '__main__':
    app.run(debug=True)
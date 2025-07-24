import numpy as np
import librosa
from multiprocessing import Pool

def process_segment(args):
    segment, sr, n_mfcc, n_fft, hop_length = args
    mfcc = librosa.feature.mfcc(y=segment, sr=sr, n_mfcc=n_mfcc, n_fft=n_fft, hop_length=hop_length)
    delta = librosa.feature.delta(mfcc)
    delta2 = librosa.feature.delta(mfcc, order=2)
    mfcc_stack = np.stack([mfcc, delta, delta2], axis=0)
    return mfcc_stack.transpose(2, 1, 0)

def extract_features_segments(file_path, segment_duration=5, n_mfcc=13, n_fft=2048, hop_length=512):
    try:
        data, sr = librosa.load(file_path, sr=22050)
        segment_length = int(segment_duration * sr)

        segments = []
        for start in range(0, len(data), segment_length):
            end = start + segment_length
            if end > len(data):
                break
            segments.append(data[start:end])

        # Prepare args for multiprocessing
        args_list = [(seg, sr, n_mfcc, n_fft, hop_length) for seg in segments]

        with Pool() as pool:
            features_list = pool.map(process_segment, args_list)

        return np.array(features_list)
    except Exception as e:
        print(f"[ERROR] Feature extraction failed: {e}")
        return None
